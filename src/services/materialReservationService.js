const prisma = require('../repositories/prisma')
const { getReleasedProcurementSnapshot } = require('./procurementSnapshotService')
const { AUDIT_EVENTS, safeAudit }        = require('./auditService')
const { getCompanyId }                   = require('../utils/company')

// Material reservations are derived exclusively from released procurement snapshots.
// reservedQuantity is ALWAYS finalConsumptionKg — never recalculated after creation.
// Idempotency enforced by @@unique([companyId, assemblyRevisionId, materialId, coatingSnapshotId]).

// ─── MR-1  Create reservations from released revision ────────────────────────

// Creates one MaterialReservation per coating snapshot row in the released revision.
// Idempotent: skips rows that already have a RESERVED reservation (unique constraint).
// Throws if any assembly has no released revision (procurement snapshot guard handles this).
async function createReservationsFromReleasedRevision(orderId) {
  const companyId = await getCompanyId()

  // Load procurement snapshot — this enforces order status + PV-1/PV-2/PV-3 guards.
  const snapshot = await getReleasedProcurementSnapshot(orderId)

  const rows = []
  for (const asm of snapshot.assemblies) {
    for (const coating of asm.coatings) {
      if (!coating.coatingMaterialId) continue
      if (coating.finalConsumptionKg == null || coating.finalConsumptionKg <= 0) continue

      rows.push({
        companyId,
        orderId,
        assemblyRevisionId: asm.releasedRevisionId,
        materialId:         coating.coatingMaterialId,
        coatingSnapshotId:  coating.snapshotId ?? null,
        reservationType:    'PROCUREMENT',
        status:             'RESERVED',
        reservedQuantity:   coating.finalConsumptionKg,
        unit:               'kg',
        reservedAt:         new Date(),
      })
    }
  }

  if (rows.length === 0) {
    safeAudit({
      eventType:  AUDIT_EVENTS.MATERIAL_RESERVATION_BLOCKED,
      entityType: 'ORDER',
      entityId:   orderId,
      orderId,
      payload:    { reason: 'No eligible coating snapshots with positive finalConsumptionKg', orderId },
    })
    throw new Error('No eligible coating snapshots found for reservation')
  }

  // MR-4: Idempotency — skip existing RESERVED rows via skipDuplicates.
  const result = await prisma.materialReservation.createMany({
    data:           rows,
    skipDuplicates: true,
  })

  safeAudit({
    eventType:  AUDIT_EVENTS.MATERIAL_RESERVED,
    entityType: 'ORDER',
    entityId:   orderId,
    orderId,
    payload: {
      orderId,
      createdCount: result.count,
      skippedCount: rows.length - result.count,
      assemblyCount: snapshot.assemblies.length,
      releasedRevisionIds: snapshot.releasedRevisionIds,
    },
  })

  return { created: result.count, skipped: rows.length - result.count }
}

// ─── MR-2  Aggregated totals per material ────────────────────────────────────

async function getReservedMaterialTotals(companyId) {
  const reservations = await prisma.materialReservation.findMany({
    where:  { companyId, status: 'RESERVED' },
    select: {
      materialId:      true,
      reservedQuantity: true,
      unit:            true,
      material: { select: { code: true, name: true, coatingType: true, supplierName: true } },
    },
  })

  const totalsMap = {}
  for (const r of reservations) {
    if (!totalsMap[r.materialId]) {
      totalsMap[r.materialId] = {
        materialId:         r.materialId,
        materialCode:       r.material.code,
        materialName:       r.material.name,
        coatingType:        r.material.coatingType,
        supplierName:       r.material.supplierName ?? null,
        totalReservedQty:   0,
        unit:               r.unit,
        reservationCount:   0,
      }
    }
    totalsMap[r.materialId].totalReservedQty   += Number(r.reservedQuantity)
    totalsMap[r.materialId].reservationCount   += 1
  }

  return Object.values(totalsMap).map(t => ({
    ...t,
    totalReservedQty: Math.round(t.totalReservedQty * 10000) / 10000,
  }))
}

// ─── MR-3  All reservations for an order ─────────────────────────────────────

async function getOrderReservations(orderId) {
  return prisma.materialReservation.findMany({
    where:   { orderId },
    include: { material: { select: { code: true, name: true, coatingType: true, supplierName: true } } },
    orderBy: [{ assemblyRevisionId: 'asc' }, { createdAt: 'asc' }],
  })
}

// ─── Cancel reservation ───────────────────────────────────────────────────────

async function cancelReservation(reservationId) {
  const reservation = await prisma.materialReservation.findUnique({
    where:  { id: reservationId },
    select: { id: true, status: true, orderId: true, materialId: true },
  })
  if (!reservation) throw new Error('MaterialReservation not found')
  if (reservation.status === 'CANCELLED') throw new Error('Reservation is already cancelled')

  const updated = await prisma.materialReservation.update({
    where: { id: reservationId },
    data:  { status: 'CANCELLED', cancelledAt: new Date() },
  })

  safeAudit({
    eventType:  AUDIT_EVENTS.MATERIAL_RESERVATION_CANCELLED,
    entityType: 'ORDER',
    entityId:   reservation.orderId,
    orderId:    reservation.orderId,
    payload:    { reservationId, materialId: reservation.materialId, previousStatus: reservation.status },
  })

  return updated
}

module.exports = {
  createReservationsFromReleasedRevision,
  getReservedMaterialTotals,
  getOrderReservations,
  cancelReservation,
}
