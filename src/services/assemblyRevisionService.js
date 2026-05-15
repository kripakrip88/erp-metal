const prisma        = require('../repositories/prisma')
const { Prisma }    = require('@prisma/client')

// Formula version constants — bump when calculation logic changes so old revisions
// remain deterministically reproducible.
const CALCULATION_FORMULA_VERSION = '1.0'
const PRICING_FORMULA_VERSION     = '1.0'

// ─── 5.3.8 RF-1 — Decimal normalisation for deterministic revision diffing ────

// Decimal/string normalization required for deterministic ERP revision diffing.
// Prisma.Decimal serialises with variable precision ("0.1440" vs "0.144" for the
// same value), producing false-positive MODIFIED entries in compareRevisions.
// Using .toFixed() collapses all trailing-zero variants to a canonical form.
function normaliseCompareValue(value) {
  if (value == null) return ''
  if (value instanceof Prisma.Decimal) return value.toFixed()
  if (typeof value === 'object') return new Prisma.Decimal(value).toFixed()
  return String(value)
}

// ─── Internal guards ──────────────────────────────────────────────────────────

async function _loadRevision(tx, revisionId) {
  const rev = await tx.assemblyRevision.findUnique({ where: { id: revisionId } })
  if (!rev) throw new Error('AssemblyRevision not found')
  return rev
}

function _assertDraft(rev) {
  if (rev.status !== 'DRAFT') {
    throw new Error('Frozen revision cannot be modified')
  }
}

// ─── 5.3.1 — Create draft revision ───────────────────────────────────────────

async function createDraftRevision(assemblyId, { createdByUserId = null, notes = null } = {}) {
  const existingDraft = await prisma.assemblyRevision.findFirst({
    where: { assemblyId, status: 'DRAFT' },
  })
  if (existingDraft) throw new Error('Assembly already has an active DRAFT revision')

  const last = await prisma.assemblyRevision.findFirst({
    where: { assemblyId },
    orderBy: { revisionNumber: 'desc' },
  })
  const revisionNumber = last ? last.revisionNumber + 1 : 1

  // DB partial unique index is the final integrity layer against concurrent DRAFT creation.
  try {
    return await prisma.assemblyRevision.create({
      data: { assemblyId, revisionNumber, status: 'DRAFT', createdByUserId, notes },
      include: { coatingSnapshots: { orderBy: { position: 'asc' } } },
    })
  } catch (err) {
    if (err.code === 'P2002') throw new Error('Assembly already has active DRAFT revision')
    throw err
  }
}

// ─── 5.3.3 — Freeze pipeline ─────────────────────────────────────────────────

async function freezeAssemblyRevision(revisionId, { frozenByUserId = null, freezeReason = null } = {}) {
  return prisma.$transaction(async (tx) => {
    const rev = await _loadRevision(tx, revisionId)
    _assertDraft(rev)

    // Snapshot all current live AssemblyCoating rows at freeze time
    const coatings = await tx.assemblyCoating.findMany({
      where: { assemblyId: rev.assemblyId },
      orderBy: { position: 'asc' },
    })

    if (coatings.length === 0) {
      throw new Error('Cannot freeze an empty revision — add coatings first')
    }

    // createMany bypasses hooks — all snapshot/formula fields pre-computed here
    await tx.assemblyRevisionCoatingSnapshot.createMany({
      data: coatings.map(c => ({
        assemblyRevisionId:        rev.id,
        assemblyId:                rev.assemblyId,
        coatingMaterialId:         c.coatingMaterialId,
        materialCodeSnapshot:      c.materialCodeSnapshot ?? '',
        materialNameSnapshot:      c.materialNameSnapshot ?? '',
        layerNumber:               c.layerNumber,
        position:                  c.position,
        selectedDftMkm:            c.selectedDftMkm            ?? null,
        dilutionPercent:           c.dilutionPercent            ?? null,
        lossFactorPercent:         c.lossFactorPercent          ?? null,
        theoreticalConsumptionKg:  c.theoreticalConsumptionKg  ?? null,
        finalConsumptionKg:        c.finalConsumptionKg         ?? null,
        costSnapshotPerKg:         c.costSnapshotPerKg          ?? null,
        calculatedCost:            c.calculatedCost             ?? null,
        calculationFormulaVersion: CALCULATION_FORMULA_VERSION,
        pricingFormulaVersion:     PRICING_FORMULA_VERSION,
      })),
    })

    // Aggregate totals from live coating data at freeze time — null-safe summation.
    // Reflects exact historical state: pricing, consumption, and cost are immutable
    // after freeze even if formulas, catalog prices, or coating systems change later.
    // TODO: extend with labor totals, material totals, routing totals, overhead totals,
    //   margin totals, tax snapshots, multi-currency totals
    let totalTheoreticalConsumptionKg = new Prisma.Decimal(0)
    let totalFinalConsumptionKg       = new Prisma.Decimal(0)
    let totalCalculatedCost           = new Prisma.Decimal(0)
    for (const c of coatings) {
      if (c.theoreticalConsumptionKg != null)
        totalTheoreticalConsumptionKg = totalTheoreticalConsumptionKg.add(new Prisma.Decimal(c.theoreticalConsumptionKg))
      if (c.finalConsumptionKg != null)
        totalFinalConsumptionKg = totalFinalConsumptionKg.add(new Prisma.Decimal(c.finalConsumptionKg))
      if (c.calculatedCost != null)
        totalCalculatedCost = totalCalculatedCost.add(new Prisma.Decimal(c.calculatedCost))
    }

    return tx.assemblyRevision.update({
      where: { id: revisionId },
      data: {
        status:        'FROZEN',
        frozenAt:      new Date(),
        frozenByUserId,
        freezeReason,
        totalTheoreticalConsumptionKg: totalTheoreticalConsumptionKg.toDecimalPlaces(4),
        totalFinalConsumptionKg:       totalFinalConsumptionKg.toDecimalPlaces(4),
        totalCalculatedCost:           totalCalculatedCost.toDecimalPlaces(2),
      },
      include: { coatingSnapshots: { orderBy: { position: 'asc' } } },
    })
  })
}

// ─── 5.3.4 — Clone revision ───────────────────────────────────────────────────

async function createAssemblyRevisionFromRevision(sourceRevisionId, { createdByUserId = null, notes = null } = {}) {
  return prisma.$transaction(async (tx) => {
    const source = await _loadRevision(tx, sourceRevisionId)
    // Only clone from frozen revisions — DRAFT would create ambiguous state
    if (source.status === 'DRAFT') {
      throw new Error('Cannot clone an unfrozen DRAFT revision — freeze it first')
    }

    const existingDraft = await tx.assemblyRevision.findFirst({
      where: { assemblyId: source.assemblyId, status: 'DRAFT' },
    })
    if (existingDraft) throw new Error('Assembly already has an active DRAFT revision')

    const last = await tx.assemblyRevision.findFirst({
      where: { assemblyId: source.assemblyId },
      orderBy: { revisionNumber: 'desc' },
    })
    const revisionNumber = last ? last.revisionNumber + 1 : 1

    const newRevision = await tx.assemblyRevision.create({
      data: {
        assemblyId:            source.assemblyId,
        revisionNumber,
        status:                'DRAFT',
        createdFromRevisionId: sourceRevisionId,
        createdByUserId,
        notes,
      },
    })

    // Clone snapshots from source — new revision is editable, source remains immutable
    const sourceSnapshots = await tx.assemblyRevisionCoatingSnapshot.findMany({
      where: { assemblyRevisionId: sourceRevisionId },
      orderBy: { position: 'asc' },
    })

    if (sourceSnapshots.length > 0) {
      await tx.assemblyRevisionCoatingSnapshot.createMany({
        data: sourceSnapshots.map(({ id, assemblyRevisionId, createdAt, ...rest }) => ({
          ...rest,
          assemblyRevisionId: newRevision.id,
        })),
      })
    }

    return tx.assemblyRevision.findUnique({
      where: { id: newRevision.id },
      include: { coatingSnapshots: { orderBy: { position: 'asc' } } },
    })
  })
}

// ─── 5.3.5 — Immutable protection ────────────────────────────────────────────

// Guard for any operation that mutates a revision or its snapshots.
// Call before update, delete, recalculate, or snapshot overwrite.
async function assertRevisionMutable(revisionId) {
  const rev = await prisma.assemblyRevision.findUnique({
    where: { id: revisionId },
    select: { status: true },
  })
  if (!rev) throw new Error('AssemblyRevision not found')
  if (rev.status !== 'DRAFT') throw new Error('Frozen revision cannot be modified')
}

// ─── 5.3.2 — Assembly-level immutability enforcement ─────────────────────────

// Blocks any mutation on an assembly that participates in a FROZEN revision.
// Call before create/update/delete/recalculate on AssemblyCoating rows.
// Centralized — single query, no inline duplicates across mutation flows.
// TODO: partial locking by revision scope (lock only specific coating layers)
// TODO: optimistic locking (revision counter on AssemblyRevision, check-and-increment)
// TODO: concurrent revision branching (allow multiple DRAFT revisions per assembly)
// TODO: assembly revision merge strategy (merge diverged DRAFT branches)
async function assertAssemblyMutable(assemblyId) {
  const locked = await prisma.assemblyRevision.findFirst({
    where:  { assemblyId, status: 'FROZEN' },
    select: { id: true },
    take:   1,
  })
  if (locked) throw new Error('Assembly is locked by a frozen revision')
}

// ─── Read ─────────────────────────────────────────────────────────────────────

async function listAssemblyRevisions(assemblyId) {
  return prisma.assemblyRevision.findMany({
    where: { assemblyId },
    include: { coatingSnapshots: { orderBy: { position: 'asc' } } },
    orderBy: { revisionNumber: 'desc' },
  })
}

async function getAssemblyRevision(revisionId) {
  const rev = await prisma.assemblyRevision.findUnique({
    where: { id: revisionId },
    include: { coatingSnapshots: { orderBy: { position: 'asc' } } },
  })
  if (!rev) throw new Error('AssemblyRevision not found')
  return rev
}

// ─── 5.3.5 — Revision diff expansion ─────────────────────────────────────────

// Only immutable snapshot fields.
// Do not compare runtime/live relational data.
const COMPARE_FIELDS = [
  'coatingMaterialId',
  'materialCodeSnapshot',
  'materialNameSnapshot',
  'theoreticalConsumptionKg',
  'finalConsumptionKg',
  'costSnapshotPerKg',
  'calculatedCost',
  'calculationFormulaVersion',
  'pricingFormulaVersion',
]

// Pure historical compare — snapshot vs snapshot only.
// No live data, no recalculate, no material lookup.
// TODO: visual diff UI
// TODO: PDF diff export
// TODO: tolerance diff (flag changes below significance threshold)
// TODO: semantic diff (group by coating type, material family)
// TODO: grouped financial diff (subtotals by primer/base/topcoat)
// TODO: approval diff workflow (require sign-off on MODIFIED layers)
// TODO: diff pagination for huge assemblies (large layer counts)
// TODO: structural diff grouping (group layers by coating system origin)
// TODO: assembly-level change severity scoring (LOW / MEDIUM / HIGH / CRITICAL)
// TODO: automated commercial impact scoring (cost delta → quote impact %)
async function compareRevisions(revisionIdA, revisionIdB) {
  const [revA, revB] = await Promise.all([
    getAssemblyRevision(revisionIdA),
    getAssemblyRevision(revisionIdB),
  ])

  if (revA.assemblyId !== revB.assemblyId) {
    throw new Error('Cannot compare revisions from different assemblies')
  }

  const byLayer   = snaps => Object.fromEntries(snaps.map(s => [s.layerNumber, s]))
  const mapA      = byLayer(revA.coatingSnapshots)
  const mapB      = byLayer(revB.coatingSnapshots)
  const allLayers = [...new Set([
    ...Object.keys(mapA),
    ...Object.keys(mapB),
  ].map(Number))].sort((a, b) => a - b)

  // Totals — null-safe aggregation from snapshots, no live data
  let totalTheoA = new Prisma.Decimal(0)
  let totalFinalA = new Prisma.Decimal(0)
  let totalCostA  = new Prisma.Decimal(0)
  let totalTheoB  = new Prisma.Decimal(0)
  let totalFinalB = new Prisma.Decimal(0)
  let totalCostB  = new Prisma.Decimal(0)

  const layers = []

  for (const layerNum of allLayers) {
    const a = mapA[layerNum]
    const b = mapB[layerNum]

    if (a?.theoreticalConsumptionKg != null) totalTheoA  = totalTheoA.add(new Prisma.Decimal(a.theoreticalConsumptionKg))
    if (a?.finalConsumptionKg != null)        totalFinalA = totalFinalA.add(new Prisma.Decimal(a.finalConsumptionKg))
    if (a?.calculatedCost != null)            totalCostA  = totalCostA.add(new Prisma.Decimal(a.calculatedCost))
    if (b?.theoreticalConsumptionKg != null) totalTheoB  = totalTheoB.add(new Prisma.Decimal(b.theoreticalConsumptionKg))
    if (b?.finalConsumptionKg != null)        totalFinalB = totalFinalB.add(new Prisma.Decimal(b.finalConsumptionKg))
    if (b?.calculatedCost != null)            totalCostB  = totalCostB.add(new Prisma.Decimal(b.calculatedCost))

    if (a && b) {
      const changedFields = COMPARE_FIELDS.filter(
        field => normaliseCompareValue(a[field]) !== normaliseCompareValue(b[field])
      )
      if (changedFields.length > 0) {
        layers.push({ layerNumber: layerNum, position: a.position, changeType: 'MODIFIED', before: a, after: b, changedFields })
      } else {
        layers.push({ layerNumber: layerNum, position: a.position, changeType: 'UNCHANGED' })
      }
    } else if (a) {
      layers.push({ layerNumber: layerNum, position: a.position, changeType: 'REMOVED', before: a, after: null })
    } else {
      layers.push({ layerNumber: layerNum, position: b.position, changeType: 'ADDED', before: null, after: b })
    }
  }

  // Stable sort: primary layerNumber, secondary position
  layers.sort((x, y) => x.layerNumber - y.layerNumber || x.position - y.position)

  return {
    revisionA: { id: revA.id, revisionNumber: revA.revisionNumber, status: revA.status },
    revisionB: { id: revB.id, revisionNumber: revB.revisionNumber, status: revB.status },
    layers,
    totals: {
      revisionA: {
        totalTheoreticalConsumptionKg: totalTheoA.toDecimalPlaces(4),
        totalFinalConsumptionKg:       totalFinalA.toDecimalPlaces(4),
        totalCalculatedCost:           totalCostA.toDecimalPlaces(2),
      },
      revisionB: {
        totalTheoreticalConsumptionKg: totalTheoB.toDecimalPlaces(4),
        totalFinalConsumptionKg:       totalFinalB.toDecimalPlaces(4),
        totalCalculatedCost:           totalCostB.toDecimalPlaces(2),
      },
      delta: {
        totalTheoreticalConsumptionKg: totalTheoB.sub(totalTheoA).toDecimalPlaces(4),
        totalFinalConsumptionKg:       totalFinalB.sub(totalFinalA).toDecimalPlaces(4),
        totalCalculatedCost:           totalCostB.sub(totalCostA).toDecimalPlaces(2),
      },
    },
  }
}

// ─── 5.3.4 — Revision restore engine ─────────────────────────────────────────

// Overwrites live AssemblyCoating rows with exact snapshot values from a FROZEN revision.
// restore ≠ clone: restore mutates current assembly state; clone creates a new revision.
// Snapshot values are not recalculated — exact historical pricing and consumption preserved.
// calculationFormulaVersion and pricingFormulaVersion are snapshot-only fields not present
// on AssemblyCoating; they are intentionally excluded from the restore target.
// autoAreaLink=true / manualAreaM2=null satisfies the XOR DB constraint and avoids
// accidental recalculation overwrites on any subsequent recalculate call.
// TODO: partial restore — restore only specific layer numbers
// TODO: merge restore — merge restored coatings with existing live rows
// TODO: dry-run restore — preview changes without committing (returns diff only)
// TODO: restore preview diff — show what would change before committing
// TODO: conflict detection — detect live-state divergence before overwriting
// TODO: restore approval workflow — require sign-off before commit
// TODO: restore audit event — log restore actor, source revision, timestamp
// TODO: restore rollback snapshot — auto-snapshot current state before overwriting
// TODO: restore authorization — require explicit approval before overwriting live state
async function restoreAssemblyFromRevision(revisionId) {
  const revision = await prisma.assemblyRevision.findUnique({
    where:   { id: revisionId },
    include: { coatingSnapshots: { orderBy: { position: 'asc' } } },
  })
  if (!revision) throw new Error('AssemblyRevision not found')
  if (revision.status !== 'FROZEN') throw new Error('Can only restore from a FROZEN revision')
  if (revision.coatingSnapshots.length === 0) throw new Error('Revision has no coating snapshots to restore')

  // Restore is an explicit privileged rollback operation.
  // Frozen revisions protect normal mutations, but restore intentionally
  // overwrites live assembly state from historical snapshot.
  // TODO: role-based restore authorization (restrict to admin/manager roles)
  // TODO: restore approval workflow (require second approver before overwrite)
  // TODO: restore audit event (log who restored, from which revision, when)
  // TODO: restore lock window (block concurrent restores on same assembly)
  // TODO: dual-confirm restore (require explicit confirmation token before commit)

  return prisma.$transaction(async (tx) => {
    // Replace all live coatings atomically — restore overwrites, does not merge
    await tx.assemblyCoating.deleteMany({ where: { assemblyId: revision.assemblyId } })

    await tx.assemblyCoating.createMany({
      data: revision.coatingSnapshots.map(s => ({
        assemblyId:               revision.assemblyId,
        coatingMaterialId:        s.coatingMaterialId,
        coatingSystemId:          null,
        layerNumber:              s.layerNumber,
        position:                 s.position,
        autoAreaLink:             true,
        manualAreaM2:             null,
        selectedDftMkm:           s.selectedDftMkm            ?? null,
        dilutionPercent:          s.dilutionPercent            ?? null,
        lossFactorPercent:        s.lossFactorPercent          ?? null,
        materialCodeSnapshot:     s.materialCodeSnapshot,
        materialNameSnapshot:     s.materialNameSnapshot,
        theoreticalConsumptionKg: s.theoreticalConsumptionKg  ?? null,
        finalConsumptionKg:       s.finalConsumptionKg         ?? null,
        costSnapshotPerKg:        s.costSnapshotPerKg          ?? null,
        calculatedCost:           s.calculatedCost             ?? null,
      })),
    })

    return {
      restoredCount: revision.coatingSnapshots.length,
      revisionId,
      assemblyId:    revision.assemblyId,
    }
  })
}

// ─── 5.3.7 — Audit foundation ─────────────────────────────────────────────────
// Audit-ready fields captured on every revision:
//   createdByUserId, frozenByUserId, freezeReason, createdFromRevisionId (source linkage)
// TODO: audit log entries on freeze/clone/archive events
// TODO: approval workflow (SUBMITTED → APPROVED/REJECTED status transitions)
// TODO: digital approval history (approverUserId, approvedAt, approvalSignature)

// ─── 5.3.8 — Future ERP hooks ─────────────────────────────────────────────────
// TODO: PDF estimate snapshot generation on freeze
// TODO: XLSX estimate export per revision
// TODO: procurement freeze — lock supplier quotations at revision
// TODO: warehouse reservation freeze — reserve stock at revision
// TODO: production planning freeze — lock routing/BOM at revision
// TODO: profitability freeze — lock margin/KPI at revision
// TODO: client approval workflow — send revision for client sign-off
// TODO: e-sign integration — digital signature on frozen revisions

module.exports = {
  createDraftRevision,
  freezeAssemblyRevision,
  createAssemblyRevisionFromRevision,
  restoreAssemblyFromRevision,
  assertRevisionMutable,
  assertAssemblyMutable,
  listAssemblyRevisions,
  getAssemblyRevision,
  compareRevisions,
}
