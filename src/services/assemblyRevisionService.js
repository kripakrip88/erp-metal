const prisma        = require('../repositories/prisma')
const { Prisma }    = require('@prisma/client')

// Formula version constants — bump when calculation logic changes so old revisions
// remain deterministically reproducible.
const CALCULATION_FORMULA_VERSION = '1.0'
const PRICING_FORMULA_VERSION     = '1.0'

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

  return prisma.assemblyRevision.create({
    data: { assemblyId, revisionNumber, status: 'DRAFT', createdByUserId, notes },
    include: { coatingSnapshots: { orderBy: { position: 'asc' } } },
  })
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

    if (coatings.length > 0) {
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
    }

    return tx.assemblyRevision.update({
      where: { id: revisionId },
      data: {
        status:        'FROZEN',
        frozenAt:      new Date(),
        frozenByUserId,
        freezeReason,
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

// ─── 5.3.6 — Revision compare ────────────────────────────────────────────────

// Fields compared per layer to detect coating/consumption/pricing/formula changes.
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

async function compareRevisions(revisionIdA, revisionIdB) {
  const [revA, revB] = await Promise.all([
    getAssemblyRevision(revisionIdA),
    getAssemblyRevision(revisionIdB),
  ])

  const byLayer  = snaps => Object.fromEntries(snaps.map(s => [s.layerNumber, s]))
  const mapA     = byLayer(revA.coatingSnapshots)
  const mapB     = byLayer(revB.coatingSnapshots)
  const allLayers = [...new Set([
    ...Object.keys(mapA),
    ...Object.keys(mapB),
  ].map(Number))].sort((a, b) => a - b)

  const added     = []
  const removed   = []
  const changed   = []
  const unchanged = []
  let totalCostA  = new Prisma.Decimal(0)
  let totalCostB  = new Prisma.Decimal(0)

  for (const layer of allLayers) {
    const a = mapA[layer]
    const b = mapB[layer]

    if (a?.calculatedCost != null) totalCostA = totalCostA.add(new Prisma.Decimal(a.calculatedCost))
    if (b?.calculatedCost != null) totalCostB = totalCostB.add(new Prisma.Decimal(b.calculatedCost))

    if (a && b) {
      const diffs = {}
      for (const field of COMPARE_FIELDS) {
        if (String(a[field] ?? '') !== String(b[field] ?? '')) {
          diffs[field] = { from: a[field], to: b[field] }
        }
      }
      if (Object.keys(diffs).length > 0) {
        changed.push({ layerNumber: layer, diffs })
      } else {
        unchanged.push(layer)
      }
    } else if (a) {
      removed.push(a)
    } else {
      added.push(b)
    }
  }

  return {
    revisionA:      { id: revA.id, revisionNumber: revA.revisionNumber, status: revA.status },
    revisionB:      { id: revB.id, revisionNumber: revB.revisionNumber, status: revB.status },
    added,
    removed,
    changed,
    unchanged,
    totalCostDelta: totalCostB.sub(totalCostA).toDecimalPlaces(2),
  }
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
  assertRevisionMutable,
  listAssemblyRevisions,
  getAssemblyRevision,
  compareRevisions,
}
