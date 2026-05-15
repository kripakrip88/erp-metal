const prisma = require('../repositories/prisma')
const { calcLinearWeight, calcAreaWeight } = require('../calculations/weightCalc')
const { calcLinearPaint, calcAreaPaint }   = require('../calculations/paintCalc')
const { calcMaterialCost }                 = require('../calculations/costCalc')
const { AUDIT_EVENTS, safeAudit }          = require('./auditService')

// Commercial quote snapshots must NEVER read live engineering workspace data.
// releasedRevisionId is the single source of truth for commercial provenance.
// Quote revisions are immutable commercial documents.

// ─── Active quote pointer ─────────────────────────────────────────────────────

// Sets order.activeQuoteRevisionId inside an existing transaction.
// Supersedes the current active quote if it differs from the new target.
// Returns the previous activeQuoteRevisionId for post-commit audit use.
async function _activateRevisionInTx(tx, orderId, newRevisionId) {
  const order = await tx.order.findUnique({
    where:  { id: orderId },
    select: { activeQuoteRevisionId: true },
  })
  const previousActiveId = order.activeQuoteRevisionId ?? null
  if (previousActiveId && previousActiveId !== newRevisionId) {
    await tx.quoteRevision.update({
      where: { id: previousActiveId },
      data:  { status: 'SUPERSEDED' },
    })
  }
  await tx.order.update({
    where: { id: orderId },
    data:  { activeQuoteRevisionId: newRevisionId },
  })
  return previousActiveId
}

// Public standalone version — owns its own transaction.
async function setActiveQuoteRevision(orderId, quoteRevisionId) {
  const qr = await prisma.quoteRevision.findUnique({
    where:  { id: quoteRevisionId },
    select: { orderId: true, status: true },
  })
  if (!qr) throw new Error('QuoteRevision not found')
  if (qr.orderId !== orderId) throw new Error('QuoteRevision does not belong to this order')
  if (qr.status === 'REJECTED') throw new Error('Cannot activate a REJECTED quote revision')

  let previousActiveQuoteRevisionId = null

  const result = await prisma.$transaction(async (tx) => {
    previousActiveQuoteRevisionId = await _activateRevisionInTx(tx, orderId, quoteRevisionId)
    return tx.order.findUnique({
      where:  { id: orderId },
      select: { id: true, activeQuoteRevisionId: true },
    })
  })

  safeAudit({
    eventType:       AUDIT_EVENTS.QUOTE_REVISION_ACTIVATED,
    entityType:      'QUOTE_REVISION',
    entityId:        quoteRevisionId,
    orderId,
    quoteRevisionId,
    payload:         { previousActiveQuoteRevisionId, supersededRevisionId: previousActiveQuoteRevisionId, sourceReleasedRevisionIds: null },
  })
  if (previousActiveQuoteRevisionId) {
    safeAudit({
      eventType:       AUDIT_EVENTS.QUOTE_REVISION_SUPERSEDED,
      entityType:      'QUOTE_REVISION',
      entityId:        previousActiveQuoteRevisionId,
      orderId,
      quoteRevisionId: previousActiveQuoteRevisionId,
      payload:         { supersededBy: quoteRevisionId },
    })
  }
  return result
}

// ─── Unreferenced frozen revision audit ──────────────────────────────────────

// Returns frozen AssemblyRevisions that are not yet linked to any commercial
// quote row. Useful for engineering cleanup — an orphan freeze was never
// commercialised and may be archived.
async function listUnreferencedFrozenRevisions(orderId) {
  const assemblies = await prisma.assembly.findMany({
    where:    { orderId },
    select: {
      id: true, name: true, releasedRevisionId: true,
      revisions: {
        where:   { status: 'FROZEN' },
        select:  {
          id: true, revisionNumber: true, frozenAt: true,
          revisionCoatingLinks: { select: { id: true }, take: 1 },
        },
        orderBy: { revisionNumber: 'desc' },
      },
    },
  })

  const result = []
  for (const asm of assemblies) {
    for (const rev of asm.revisions) {
      if (rev.revisionCoatingLinks.length === 0) {
        result.push({
          assemblyId:     asm.id,
          assemblyName:   asm.name,
          revisionId:     rev.id,
          revisionNumber: rev.revisionNumber,
          frozenAt:       rev.frozenAt,
          isReleased:     asm.releasedRevisionId === rev.id,
        })
      }
    }
  }
  return result
}

// ─── Quote revision list ──────────────────────────────────────────────────────

async function getRevisions(orderId) {
  return prisma.quoteRevision.findMany({
    where:   { orderId },
    include: { parts: true, calculation: true },
    orderBy: { revisionNumber: 'desc' },
  })
}

// ─── 5.4.5 — Snapshot-driven quote revision creation ─────────────────────────

// Commercial quote snapshots must NEVER read live engineering workspace data.
// releasedRevisionId is the single source of truth for commercial provenance.
// Quote revisions are immutable commercial documents.
async function createRevision(orderId, notes) {
  const company = await prisma.company.findFirst()
  const user    = await prisma.user.findFirst({ where: { companyId: company.id } })

  let previousActiveQuoteRevisionId = null

  const quoteRevision = await prisma.$transaction(async (tx) => {
    // ── Load assemblies ───────────────────────────────────────────────────────
    const order = await tx.order.findUnique({
      where:  { id: orderId },
      select: { id: true },
    })
    if (!order) throw new Error('Order not found')

    const assemblies = await tx.assembly.findMany({
      where:   { orderId },
      select:  { id: true, name: true, qty: true, releasedRevisionId: true },
      orderBy: { position: 'asc' },
    })
    if (assemblies.length === 0) throw new Error('Order has no assemblies')

    // ── RV-1: every assembly must have a releasedRevisionId ───────────────────
    for (const asm of assemblies) {
      if (!asm.releasedRevisionId) {
        throw new Error(`Assembly "${asm.name}" must have released revision before quote creation`)
      }
    }

    // ── RV-2 + RV-3: released revision must belong to assembly and be FROZEN ──
    const releasedRevIds = assemblies.map(a => a.releasedRevisionId)
    const frozenRevisions = await tx.assemblyRevision.findMany({
      where:  { id: { in: releasedRevIds } },
      select: { id: true, assemblyId: true, status: true },
    })
    const revMap = Object.fromEntries(frozenRevisions.map(r => [r.id, r]))

    for (const asm of assemblies) {
      const rev = revMap[asm.releasedRevisionId]
      if (!rev) {
        throw new Error(`Released revision for assembly "${asm.name}" not found`)
      }
      if (rev.assemblyId !== asm.id) {
        throw new Error(`Released revision does not belong to assembly "${asm.name}"`)
      }
      if (rev.status !== 'FROZEN') {
        throw new Error(`Released revision for assembly "${asm.name}" is not frozen`)
      }
    }

    // ── Load coating snapshots for all released revisions ─────────────────────
    const snapshots = await tx.assemblyRevisionCoatingSnapshot.findMany({
      where:   { assemblyRevisionId: { in: releasedRevIds } },
      orderBy: [{ assemblyRevisionId: 'asc' }, { position: 'asc' }],
    })

    // Group by revisionId for per-assembly access
    const snapshotsByRevId = {}
    for (const snap of snapshots) {
      if (!snapshotsByRevId[snap.assemblyRevisionId]) snapshotsByRevId[snap.assemblyRevisionId] = []
      snapshotsByRevId[snap.assemblyRevisionId].push(snap)
    }

    // ── RV-4: each released revision must have at least one coating snapshot ──
    for (const asm of assemblies) {
      const revSnaps = snapshotsByRevId[asm.releasedRevisionId]
      if (!revSnaps || revSnaps.length === 0) {
        throw new Error(`Released revision for assembly "${asm.name}" contains no coating snapshots`)
      }
    }

    // ── Batch-load coating materials (for coatingType, densityKgL, consumptionGm2) ─
    const matIds = [...new Set(snapshots.map(s => s.coatingMaterialId).filter(Boolean))]
    const materials = matIds.length > 0
      ? await tx.coatingMaterial.findMany({
          where:  { id: { in: matIds } },
          select: { id: true, coatingType: true, densityKgL: true, consumptionGm2: true },
        })
      : []
    const matById = Object.fromEntries(materials.map(m => [m.id, m]))

    // ── Load parts with full material data for BOM weight/cost calculation ────
    const asmIds = assemblies.map(a => a.id)
    const parts  = await tx.part.findMany({
      where:   { assemblyId: { in: asmIds } },
      include: {
        materialDefinition: {
          include: {
            geometry: true,
            procurementProfiles: {
              include: {
                prices: { where: { validTo: null }, orderBy: { validFrom: 'desc' }, take: 1 },
              },
            },
          },
        },
      },
    })

    // ── Compute BOM weight / cost / paint area ────────────────────────────────
    const asmById    = Object.fromEntries(assemblies.map(a => [a.id, a]))
    const asmPaintMap = Object.fromEntries(asmIds.map(id => [id, 0]))
    let totalWeight = 0, totalCost = 0, totalPaint = 0
    const revParts  = []

    for (const part of parts) {
      const asm     = asmById[part.assemblyId]
      const asmQty  = asm.qty || 1
      const mat     = part.materialDefinition
      const geo     = mat.geometry
      const profile = mat.procurementProfiles?.[0]
      const price   = profile?.prices?.[0]
      const ppt     = price ? Number(price.pricePerTon) : 0
      const ppp     = profile?.pricePerPiece != null ? Number(profile.pricePerPiece) : null

      let wpu = 0, paint = 0, totalW = 0

      if (part.measurementType === 'LINEAR' && part.length && geo.theoreticalWeightPerMeter) {
        const r = calcLinearWeight(Number(part.length), Number(geo.theoreticalWeightPerMeter), part.quantity * asmQty)
        wpu    = r.weightPerUnit
        totalW = r.totalWeight
        paint  = calcLinearPaint(Number(part.length), geo.paintSurfacePerMeter ? Number(geo.paintSurfacePerMeter) : null, part.quantity * asmQty)
      } else if (part.measurementType === 'AREA' && part.sheetWidth && part.sheetHeight) {
        const r = calcAreaWeight(Number(part.sheetWidth), Number(part.sheetHeight), geo.weightPerSquareMeter ? Number(geo.weightPerSquareMeter) : 0, part.quantity * asmQty)
        wpu    = r.weightPerUnit
        totalW = r.totalWeight
        paint  = calcAreaPaint(Number(part.sheetWidth), Number(part.sheetHeight), part.quantity * asmQty)
      } else if (part.measurementType === 'PIECE' && part.directWeightKg) {
        wpu    = Number(part.directWeightKg)
        totalW = Math.round(wpu * part.quantity * asmQty * 10000) / 10000
        paint  = 0
      }

      const cost = part.measurementType === 'PIECE' && ppp != null
        ? Math.round(part.quantity * asmQty * ppp * 10000) / 10000
        : calcMaterialCost(totalW, ppt)
      totalWeight += totalW
      totalCost   += cost
      totalPaint  += paint
      asmPaintMap[part.assemblyId] = Math.round((asmPaintMap[part.assemblyId] + paint) * 10000) / 10000

      revParts.push({
        materialDefinitionId: mat.id,
        materialCode:  mat.code,
        materialName:  mat.name,
        name:          part.name ?? null,
        materialType:  mat.materialType,
        profileType:   mat.profileType,
        steelGrade:    mat.steelGrade ?? null,
        supplierName:  profile?.supplierName || '',
        measurementType: part.measurementType,
        length:        part.length,
        sheetWidth:    part.sheetWidth,
        sheetHeight:   part.sheetHeight,
        directWeightKg: part.directWeightKg ?? null,
        quantity:      part.quantity * asmQty,
        assemblyQty:   asmQty,
        theoreticalWeightPerMeter: geo.theoreticalWeightPerMeter,
        calculatedWeightPerUnit:   wpu,
        totalWeight:   totalW,
        paintAreaM2:   paint,
        pricePerTon:   ppt,
        pricePerPiece: ppp ?? null,
        currency:      'RUB',
        materialCost:  cost,
        assemblyName:  asm.name,
      })
    }

    // ── Build coating rows exclusively from frozen engineering snapshots ───────
    // assemblyRevisionId is mandatory — every row traces to an exact engineering freeze.
    const revCoatingRows        = []
    const sourceReleasedRevisionIds = {}

    for (const asm of assemblies) {
      const revSnaps = snapshotsByRevId[asm.releasedRevisionId]
      sourceReleasedRevisionIds[asm.id] = asm.releasedRevisionId

      for (const snap of revSnaps) {
        const mat         = snap.coatingMaterialId ? matById[snap.coatingMaterialId] : null
        const consumptionGm2 = mat ? Number(mat.consumptionGm2) : 0
        // Derive areaM2 from the frozen consumption figure: theoreticalKg * 1000 / consumptionGm2
        const theorKg     = snap.theoreticalConsumptionKg ? Number(snap.theoreticalConsumptionKg) : 0
        const areaM2      = consumptionGm2 > 0
          ? Math.round(theorKg * 1000 / consumptionGm2 * 10000) / 10000
          : 0
        const consumptionKg   = theorKg
        const finalKg         = snap.finalConsumptionKg ? Number(snap.finalConsumptionKg) : consumptionKg
        const densityKgL      = mat && Number(mat.densityKgL) > 0 ? Number(mat.densityKgL) : null
        const consumptionL    = densityKgL
          ? Math.round(consumptionKg / densityKgL * 10000) / 10000
          : null
        // selectedDftMkm and dilutionPercent are NOT NULL in the schema — default to 0
        const selectedDftMkm  = snap.selectedDftMkm  ?? 0
        const dilutionPercent = snap.dilutionPercent  != null ? Number(snap.dilutionPercent) : 0

        revCoatingRows.push({
          assemblyId:        asm.id,
          assemblyName:      asm.name,
          coatingCode:       snap.materialCodeSnapshot,
          coatingName:       snap.materialNameSnapshot,
          coatingType:       mat?.coatingType ?? 'OTHER',
          layerNumber:       snap.layerNumber,
          position:          snap.position,
          areaM2,
          consumptionKg,
          consumptionL,
          totalKg:           finalKg,
          selectedDftMkm,
          dilutionPercent,
          pricePerKg:        snap.costSnapshotPerKg  != null ? Number(snap.costSnapshotPerKg) : null,
          totalCost:         snap.calculatedCost     != null ? Number(snap.calculatedCost)    : null,
          assemblyRevisionId: asm.releasedRevisionId,
        })
      }
    }

    // ── Revision number ───────────────────────────────────────────────────────
    const last   = await tx.quoteRevision.findFirst({
      where: { orderId }, orderBy: { revisionNumber: 'desc' },
    })
    const revNum = (last?.revisionNumber || 0) + 1

    // ── Create quote revision atomically ──────────────────────────────────────
    const quoteRevision = await tx.quoteRevision.create({
      data: {
        orderId, revisionNumber: revNum,
        createdById: user?.id || company.id,
        status: 'DRAFT', notes: notes || null, currency: 'RUB',
        sourceReleasedRevisionIds,
        parts:           { create: revParts },
        assemblyCoatings: { create: revCoatingRows },
        calculation:     { create: {
          calculationVersion: '2.0',
          totalWeightKg:     totalWeight,
          totalMaterialCost: totalCost,
          totalCost:         totalCost,
          totalPaintM2:      totalPaint,
          currency:          'RUB',
          materialSummary: {}, weightBreakdown: {},
          costBreakdown:   {}, pricingSummary: {}, warnings: [],
        }},
      },
      include: { parts: true, assemblyCoatings: true, calculation: true },
    })

    // ── Auto-activate: supersede previous active quote inside same transaction ─
    previousActiveQuoteRevisionId = await _activateRevisionInTx(tx, orderId, quoteRevision.id)

    return quoteRevision
  })

  safeAudit({
    eventType:       AUDIT_EVENTS.QUOTE_REVISION_CREATED,
    entityType:      'QUOTE_REVISION',
    entityId:        quoteRevision.id,
    orderId,
    quoteRevisionId: quoteRevision.id,
    companyId:       company.id,
    payload:         { revisionNumber: quoteRevision.revisionNumber, sourceReleasedRevisionIds: quoteRevision.sourceReleasedRevisionIds },
  })
  safeAudit({
    eventType:       AUDIT_EVENTS.QUOTE_REVISION_ACTIVATED,
    entityType:      'QUOTE_REVISION',
    entityId:        quoteRevision.id,
    orderId,
    quoteRevisionId: quoteRevision.id,
    companyId:       company.id,
    payload:         { previousActiveQuoteRevisionId, supersededRevisionId: previousActiveQuoteRevisionId, sourceReleasedRevisionIds: quoteRevision.sourceReleasedRevisionIds },
  })
  if (previousActiveQuoteRevisionId) {
    safeAudit({
      eventType:       AUDIT_EVENTS.QUOTE_REVISION_SUPERSEDED,
      entityType:      'QUOTE_REVISION',
      entityId:        previousActiveQuoteRevisionId,
      orderId,
      quoteRevisionId: previousActiveQuoteRevisionId,
      companyId:       company.id,
      payload:         { supersededBy: quoteRevision.id },
    })
  }
  return quoteRevision
}

module.exports = {
  getRevisions,
  createRevision,
  setActiveQuoteRevision,
  listUnreferencedFrozenRevisions,
}
