const prisma = require('../repositories/prisma')
const { AUDIT_EVENTS, safeAudit } = require('./auditService')

// Procurement reads immutable engineering release snapshots only.
// Never recalculate procurement quantities from live workspace state.
// Released procurement data is financially binding.

// Order must be in a released lifecycle state before procurement data is accessible.
// DRAFT / QUOTATION / AWAITING_APPROVAL orders have no stable production baseline.
const PROCUREMENT_ALLOWED_STATUSES = new Set(['APPROVED', 'PRODUCTION', 'COMPLETED', 'DELIVERED'])

// ─── Guard ────────────────────────────────────────────────────────────────────

async function assertProcurementReadable(orderId) {
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id: true, status: true },
  })
  if (!order) throw new Error('Order not found')
  if (!PROCUREMENT_ALLOWED_STATUSES.has(order.status)) {
    const reason = `Procurement snapshot not available — order is in ${order.status} state`
    safeAudit({
      eventType:  AUDIT_EVENTS.PROCUREMENT_ACCESS_BLOCKED,
      entityType: 'ORDER',
      entityId:   orderId,
      orderId,
      payload:    { orderStatus: order.status, reason },
    })
    throw new Error(reason)
  }
  return order
}

// ─── Pure assembly snapshot builder ──────────────────────────────────────────

// Constructs a single assembly's procurement shape from pre-loaded data.
// No DB calls — all data must be passed as arguments (batched by caller).
// Procurement reads immutable engineering release snapshots only.
// Never recalculate procurement quantities from live workspace state.
function _buildAssemblySnapshot(asm, revision, snapshots, matById) {
  let totalTheoreticalConsumptionKg = 0
  let totalFinalConsumptionKg       = 0
  let totalCalculatedCost           = 0

  const coatings = snapshots.map(snap => {
    // Procurement snapshot: NEVER read from AssemblyCoating (live workspace).
    // All consumption data comes exclusively from AssemblyRevisionCoatingSnapshot.
    const mat   = snap.coatingMaterialId ? matById[snap.coatingMaterialId] : null
    const theor = snap.theoreticalConsumptionKg != null ? Number(snap.theoreticalConsumptionKg) : 0
    const final = snap.finalConsumptionKg        != null ? Number(snap.finalConsumptionKg)       : theor
    const cost  = snap.calculatedCost            != null ? Number(snap.calculatedCost)           : 0

    totalTheoreticalConsumptionKg += theor
    totalFinalConsumptionKg       += final
    totalCalculatedCost           += cost

    return {
      coatingMaterialId:        snap.coatingMaterialId,
      coatingMaterialCode:      snap.materialCodeSnapshot,
      coatingMaterialName:      snap.materialNameSnapshot,
      layerNumber:              snap.layerNumber,
      theoreticalConsumptionKg: theor,
      finalConsumptionKg:       final,
      lossFactorPercent:        snap.lossFactorPercent != null ? Number(snap.lossFactorPercent) : null,
      costSnapshotPerKg:        snap.costSnapshotPerKg != null ? Number(snap.costSnapshotPerKg) : null,
      calculatedCost:           cost,
      // Catalog enrichment — supplier is live catalog data, not snapshotted.
      // May be null if the catalog entry was removed after freeze.
      supplier:                 mat?.supplierName ?? null,
      color:                    null,        // not captured in current schema version
      manufacturer:             null,        // not captured in current schema version
      snapshotId:               snap.id,
      snapshotRevisionId:       snap.assemblyRevisionId,
    }
  })

  return {
    assemblyId:         asm.id,
    assemblyName:       asm.name,
    releasedRevisionId: asm.releasedRevisionId,
    revisionNumber:     revision.revisionNumber,
    frozenAt:           revision.frozenAt,
    coatings,
    totals: {
      theoreticalConsumptionKg: Math.round(totalTheoreticalConsumptionKg * 10000) / 10000,
      finalConsumptionKg:       Math.round(totalFinalConsumptionKg       * 10000) / 10000,
      calculatedCost:           Math.round(totalCalculatedCost           * 100)   / 100,
    },
  }
}

// ─── Full order procurement snapshot ─────────────────────────────────────────

// Returns immutable procurement-ready snapshot for all assemblies in an order.
// All data sourced from Assembly.releasedRevisionId → AssemblyRevision →
// AssemblyRevisionCoatingSnapshot. Never reads live AssemblyCoating rows.
// Uses 4 batched queries regardless of assembly/coating count — no N+1.
async function getReleasedProcurementSnapshot(orderId) {
  await assertProcurementReadable(orderId)

  // ── Batch 1: assemblies ───────────────────────────────────────────────────
  const assemblies = await prisma.assembly.findMany({
    where:   { orderId },
    select:  { id: true, name: true, qty: true, releasedRevisionId: true },
    orderBy: { position: 'asc' },
  })
  if (assemblies.length === 0) throw new Error('Order has no assemblies')

  // PV-1: every assembly must have a released revision
  for (const asm of assemblies) {
    if (!asm.releasedRevisionId) {
      throw new Error(`Assembly "${asm.name}" has no released procurement revision`)
    }
  }

  // ── Batch 2: released revisions ───────────────────────────────────────────
  const releasedRevIds = assemblies.map(a => a.releasedRevisionId)
  const revisions = await prisma.assemblyRevision.findMany({
    where:  { id: { in: releasedRevIds } },
    select: {
      id: true, assemblyId: true, status: true,
      revisionNumber: true, frozenAt: true,
      totalTheoreticalConsumptionKg: true,
      totalFinalConsumptionKg:       true,
      totalCalculatedCost:           true,
    },
  })
  const revMap = Object.fromEntries(revisions.map(r => [r.id, r]))

  // PV-2: validate every released revision
  for (const asm of assemblies) {
    const rev = revMap[asm.releasedRevisionId]
    if (!rev) throw new Error(`Released revision for assembly "${asm.name}" not found`)
    if (rev.assemblyId !== asm.id) throw new Error(`Released revision does not belong to assembly "${asm.name}"`)
    if (rev.status !== 'FROZEN') throw new Error(`Released revision for assembly "${asm.name}" is not frozen`)
  }

  // ── Batch 3: coating snapshots ────────────────────────────────────────────
  // Procurement snapshot: NEVER read from AssemblyCoating.
  const snapshots = await prisma.assemblyRevisionCoatingSnapshot.findMany({
    where:   { assemblyRevisionId: { in: releasedRevIds } },
    orderBy: [{ assemblyRevisionId: 'asc' }, { position: 'asc' }],
  })

  const snapshotsByRevId = {}
  for (const snap of snapshots) {
    if (!snapshotsByRevId[snap.assemblyRevisionId]) snapshotsByRevId[snap.assemblyRevisionId] = []
    snapshotsByRevId[snap.assemblyRevisionId].push(snap)
  }

  // PV-3: each revision must have snapshot rows
  for (const asm of assemblies) {
    if (!snapshotsByRevId[asm.releasedRevisionId]?.length) {
      throw new Error(`Released revision for assembly "${asm.name}" contains no procurement snapshots`)
    }
  }

  // ── Batch 4: coating material enrichment (supplier) ───────────────────────
  // Live catalog data — enriches snapshot with current supplier info.
  // Snapshot remains valid even if catalog entry is later removed.
  const matIds = [...new Set(snapshots.map(s => s.coatingMaterialId).filter(Boolean))]
  const materials = matIds.length > 0
    ? await prisma.coatingMaterial.findMany({
        where:  { id: { in: matIds } },
        select: { id: true, supplierName: true },
      })
    : []
  const matById = Object.fromEntries(materials.map(m => [m.id, m]))

  // ── Build snapshot — no further DB calls ─────────────────────────────────
  let totalTheoreticalConsumptionKg = 0
  let totalFinalConsumptionKg       = 0
  let totalCalculatedCost           = 0

  const assemblySnapshots = assemblies.map(asm => {
    const snap = _buildAssemblySnapshot(
      asm,
      revMap[asm.releasedRevisionId],
      snapshotsByRevId[asm.releasedRevisionId],
      matById
    )
    totalTheoreticalConsumptionKg += snap.totals.theoreticalConsumptionKg
    totalFinalConsumptionKg       += snap.totals.finalConsumptionKg
    totalCalculatedCost           += snap.totals.calculatedCost
    return snap
  })

  // releasedAt: latest frozenAt across all released revisions — best approximation
  // of when the order's production baseline was established.
  const releasedAt = revisions.reduce((latest, r) => {
    if (!r.frozenAt) return latest
    return !latest || r.frozenAt > latest ? r.frozenAt : latest
  }, null)

  const result = {
    orderId,
    releasedAt,
    releasedRevisionIds: releasedRevIds,
    assemblies:          assemblySnapshots,
    totals: {
      totalTheoreticalConsumptionKg: Math.round(totalTheoreticalConsumptionKg * 10000) / 10000,
      totalFinalConsumptionKg:       Math.round(totalFinalConsumptionKg       * 10000) / 10000,
      totalCalculatedCost:           Math.round(totalCalculatedCost           * 100)   / 100,
    },
  }

  safeAudit({
    eventType:  AUDIT_EVENTS.PROCUREMENT_SNAPSHOT_GENERATED,
    entityType: 'ORDER',
    entityId:   orderId,
    orderId,
    payload: {
      orderId,
      assemblyCount:       assemblies.length,
      releasedRevisionIds: releasedRevIds,
      totalCalculatedCost: result.totals.totalCalculatedCost,
    },
  })

  return result
}

// ─── Single assembly procurement snapshot ────────────────────────────────────

// Returns immutable procurement snapshot for a single assembly.
// Uses 4 queries: assembly + order status, revision, snapshots, materials.
async function getAssemblyProcurementSnapshot(assemblyId) {
  const asm = await prisma.assembly.findUnique({
    where:  { id: assemblyId },
    select: {
      id: true, name: true, qty: true, releasedRevisionId: true, orderId: true,
      order: { select: { status: true } },
    },
  })
  if (!asm) throw new Error('Assembly not found')

  if (!PROCUREMENT_ALLOWED_STATUSES.has(asm.order.status)) {
    const reason = `Procurement snapshot not available — order is in ${asm.order.status} state`
    safeAudit({
      eventType:  AUDIT_EVENTS.PROCUREMENT_ACCESS_BLOCKED,
      entityType: 'ASSEMBLY',
      entityId:   assemblyId,
      orderId:    asm.orderId,
      assemblyId,
      payload:    { orderStatus: asm.order.status, reason },
    })
    throw new Error(reason)
  }

  // PV-1
  if (!asm.releasedRevisionId) {
    throw new Error(`Assembly "${asm.name}" has no released procurement revision`)
  }

  // PV-2
  const rev = await prisma.assemblyRevision.findUnique({
    where:  { id: asm.releasedRevisionId },
    select: {
      id: true, assemblyId: true, status: true,
      revisionNumber: true, frozenAt: true,
      totalTheoreticalConsumptionKg: true,
      totalFinalConsumptionKg:       true,
      totalCalculatedCost:           true,
    },
  })
  if (!rev) throw new Error(`Released revision for assembly "${asm.name}" not found`)
  if (rev.assemblyId !== asm.id) throw new Error(`Released revision does not belong to assembly "${asm.name}"`)
  if (rev.status !== 'FROZEN') throw new Error(`Released revision for assembly "${asm.name}" is not frozen`)

  // PV-4 enforced below: NEVER read from AssemblyCoating
  const snapshots = await prisma.assemblyRevisionCoatingSnapshot.findMany({
    where:   { assemblyRevisionId: asm.releasedRevisionId },
    orderBy: { position: 'asc' },
  })

  // PV-3
  if (snapshots.length === 0) {
    throw new Error(`Released revision for assembly "${asm.name}" contains no procurement snapshots`)
  }

  const matIds = [...new Set(snapshots.map(s => s.coatingMaterialId).filter(Boolean))]
  const materials = matIds.length > 0
    ? await prisma.coatingMaterial.findMany({
        where:  { id: { in: matIds } },
        select: { id: true, supplierName: true },
      })
    : []
  const matById = Object.fromEntries(materials.map(m => [m.id, m]))

  const result = _buildAssemblySnapshot(asm, rev, snapshots, matById)

  safeAudit({
    eventType:  AUDIT_EVENTS.PROCUREMENT_SNAPSHOT_GENERATED,
    entityType: 'ASSEMBLY',
    entityId:   assemblyId,
    orderId:    asm.orderId,
    assemblyId,
    payload: {
      orderId:             asm.orderId,
      assemblyCount:       1,
      releasedRevisionIds: [asm.releasedRevisionId],
      totalCalculatedCost: result.totals.calculatedCost,
    },
  })

  return result
}

module.exports = {
  assertProcurementReadable,
  getReleasedProcurementSnapshot,
  getAssemblyProcurementSnapshot,
}
