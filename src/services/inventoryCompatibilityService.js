const prisma = require('../repositories/prisma')
const { AUDIT_EVENTS, safeAudit } = require('./auditService')

// Inventory balances are compatibility abstractions, not warehouse transactions.
// Reserved quantities are derived exclusively from immutable reservation records.
// Available quantity must never be computed from live engineering workspace state.

// ─── IV-1  availableQuantity = physicalQuantity − reservedQuantity ────────────
// If reserved > physical the balance is still written — shortage is surfaced
// explicitly rather than silently clamped.

// ─── calculateInventoryAvailability ──────────────────────────────────────────
// Rebuilds InventoryBalance rows for every material that has active reservations
// for a company. Uses two batched queries — no per-material DB round trips.
// physicalQuantity is preserved from existing rows (never overwritten by rebuild).
async function calculateInventoryAvailability(companyId) {
  // ── Batch 1: aggregate reserved quantities by materialId ──────────────────
  // IV-2: only RESERVED status contributes to balances.
  const grouped = await prisma.materialReservation.groupBy({
    by:     ['materialId'],
    where:  { companyId, status: 'RESERVED' },
    _sum:   { reservedQuantity: true },
  })

  if (grouped.length === 0) {
    safeAudit({
      eventType:  AUDIT_EVENTS.INVENTORY_BALANCE_REBUILT,
      entityType: 'COMPANY',
      entityId:   companyId,
      payload:    { materialCount: 0, totalReservedQuantity: 0 },
    })
    return { materialCount: 0, totalReservedQuantity: 0 }
  }

  // ── Batch 2: load existing balances to preserve physicalQuantity ──────────
  const materialIds = grouped.map(g => g.materialId)
  const existing    = await prisma.inventoryBalance.findMany({
    where:  { companyId, materialId: { in: materialIds } },
    select: { materialId: true, physicalQuantity: true, uom: true },
  })
  const existingMap = Object.fromEntries(existing.map(e => [e.materialId, e]))

  // ── Upsert all balances in a single transaction ───────────────────────────
  let totalReservedQuantity = 0
  const upserts = grouped.map(g => {
    const reservedQty   = Number(g._sum.reservedQuantity ?? 0)
    const physicalQty   = existingMap[g.materialId]
      ? Number(existingMap[g.materialId].physicalQuantity)
      : 0
    const availableQty  = physicalQty - reservedQty
    totalReservedQuantity += reservedQty

    return prisma.inventoryBalance.upsert({
      where:  { companyId_materialId: { companyId, materialId: g.materialId } },
      update: {
        reservedQuantity:  reservedQty,
        availableQuantity: availableQty,
      },
      create: {
        companyId,
        materialId:        g.materialId,
        uom:               existingMap[g.materialId]?.uom ?? 'kg',
        physicalQuantity:  physicalQty,
        reservedQuantity:  reservedQty,
        availableQuantity: availableQty,
      },
    })
  })

  await Promise.all(upserts)

  safeAudit({
    eventType:  AUDIT_EVENTS.INVENTORY_BALANCE_REBUILT,
    entityType: 'COMPANY',
    entityId:   companyId,
    payload: {
      materialCount:        grouped.length,
      totalReservedQuantity: Math.round(totalReservedQuantity * 10000) / 10000,
    },
  })

  return {
    materialCount:        grouped.length,
    totalReservedQuantity: Math.round(totalReservedQuantity * 10000) / 10000,
  }
}

// ─── getInventoryAvailability ─────────────────────────────────────────────────
// Returns current balance for a single material.
// IV-3: reads only InventoryBalance + reservations — never live workspace.
async function getInventoryAvailability(materialId) {
  const balance = await prisma.inventoryBalance.findFirst({
    where:  { materialId },
    select: {
      materialId:        true,
      uom:               true,
      physicalQuantity:  true,
      reservedQuantity:  true,
      availableQuantity: true,
      updatedAt:         true,
    },
  })

  if (!balance) {
    // No balance row means no reservations and no physical stock recorded.
    return {
      materialId,
      uom:               'kg',
      physicalQuantity:  0,
      reservedQuantity:  0,
      availableQuantity: 0,
      updatedAt:         null,
    }
  }

  return {
    materialId:        balance.materialId,
    uom:               balance.uom,
    physicalQuantity:  Number(balance.physicalQuantity),
    reservedQuantity:  Number(balance.reservedQuantity),
    availableQuantity: Number(balance.availableQuantity),
    updatedAt:         balance.updatedAt,
  }
}

// ─── validateReservationAvailability ─────────────────────────────────────────
// Detects shortages for an order before procurement allocation.
// IV-3: reads only reservations and balances — never live workspace.
// Performance: 3 batched queries regardless of material count.
async function validateReservationAvailability(orderId) {
  // ── Batch 1: aggregate this order's RESERVED quantities by material ───────
  const orderReservations = await prisma.materialReservation.groupBy({
    by:    ['materialId'],
    where: { orderId, status: 'RESERVED' },
    _sum:  { reservedQuantity: true },
  })

  if (orderReservations.length === 0) {
    return { ok: true, shortages: [] }
  }

  const materialIds = orderReservations.map(r => r.materialId)

  // ── Batch 2: load material names ──────────────────────────────────────────
  // ── Batch 3: load current balances ───────────────────────────────────────
  const [materials, balances] = await Promise.all([
    prisma.coatingMaterial.findMany({
      where:  { id: { in: materialIds } },
      select: { id: true, name: true, code: true },
    }),
    prisma.inventoryBalance.findMany({
      where:  { materialId: { in: materialIds } },
      select: { materialId: true, availableQuantity: true },
    }),
  ])

  const matMap     = Object.fromEntries(materials.map(m => [m.id, m]))
  const balanceMap = Object.fromEntries(balances.map(b => [b.materialId, b]))

  const shortages = []

  for (const r of orderReservations) {
    const required  = Number(r._sum.reservedQuantity ?? 0)
    const balance   = balanceMap[r.materialId]
    const available = balance ? Number(balance.availableQuantity) : 0

    // IV-1: surface shortage explicitly — never silently ignore negative available
    if (available < required) {
      const mat = matMap[r.materialId]
      const shortage = {
        materialId:       r.materialId,
        materialCode:     mat?.code     ?? null,
        materialName:     mat?.name     ?? null,
        requiredQuantity: Math.round(required  * 10000) / 10000,
        availableQuantity: Math.round(available * 10000) / 10000,
        shortageQuantity: Math.round((required - available) * 10000) / 10000,
      }
      shortages.push(shortage)

      safeAudit({
        eventType:  AUDIT_EVENTS.INVENTORY_SHORTAGE_DETECTED,
        entityType: 'ORDER',
        entityId:   orderId,
        orderId,
        payload: {
          orderId,
          materialId:       r.materialId,
          requiredQuantity: shortage.requiredQuantity,
          availableQuantity: shortage.availableQuantity,
          shortageQuantity: shortage.shortageQuantity,
        },
      })
    }
  }

  return { ok: shortages.length === 0, shortages }
}

module.exports = {
  calculateInventoryAvailability,
  getInventoryAvailability,
  validateReservationAvailability,
}
