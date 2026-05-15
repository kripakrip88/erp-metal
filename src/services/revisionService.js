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
      } else if (part.measurementType === 'PIECE') {
        wpu    = Number(part.directWeightKg ?? geo.unitWeightKg ?? 0)
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
        bomTemplateCode:    part.bomTemplateCode    ?? null,
        bomTemplateId:      part.bomTemplateId      ?? null,
        bomTemplateVersion: part.bomTemplateVersion ?? null,
        bomGroupKey:        part.bomGroupKey        ?? null,
        bomGroupLabel:      part.bomGroupLabel      ?? null,
        bomDepth:           part.bomDepth           ?? null,
        bomPath:            part.bomPath            ?? null,
        bomSortPath:        part.bomSortPath        ?? null,
      })
    }

    // ── Build coating rows from live AssemblyCoating workspace ───────────────
    const asmCoatings = await tx.assemblyCoating.findMany({
      where:   { assemblyId: { in: asmIds } },
      include: { coatingMaterial: true },
      orderBy: [{ assemblyId: 'asc' }, { position: 'asc' }],
    })
    const asmById2 = Object.fromEntries(assemblies.map(a => [a.id, a]))

    const revCoatingRows = []
    for (const c of asmCoatings) {
      const asm    = asmById2[c.assemblyId]
      const mat    = c.coatingMaterial
      const theorKg      = c.theoreticalConsumptionKg ? Number(c.theoreticalConsumptionKg) : 0
      const finalKg      = c.finalConsumptionKg       ? Number(c.finalConsumptionKg)       : theorKg
      const consumptionGm2 = mat?.consumptionGm2 ? Number(mat.consumptionGm2) : 0
      const areaM2       = consumptionGm2 > 0
        ? Math.round(theorKg * 1000 / consumptionGm2 * 10000) / 10000
        : (c.manualAreaM2 ? Number(c.manualAreaM2) : 0)
      const densityKgL   = mat?.densityKgL && Number(mat.densityKgL) > 0 ? Number(mat.densityKgL) : null
      const consumptionL = densityKgL
        ? Math.round(theorKg / densityKgL * 10000) / 10000
        : null

      revCoatingRows.push({
        assemblyId:        asm.id,
        assemblyName:      asm.name,
        coatingCode:       c.materialCodeSnapshot ?? mat?.code ?? '',
        coatingName:       c.materialNameSnapshot ?? mat?.name ?? '',
        coatingType:       mat?.coatingType ?? 'OTHER',
        layerNumber:       c.layerNumber,
        position:          c.position,
        areaM2,
        consumptionKg:     theorKg,
        consumptionL,
        totalKg:           finalKg,
        selectedDftMkm:    c.selectedDftMkm  ?? 0,
        dilutionPercent:   c.dilutionPercent  != null ? Number(c.dilutionPercent) : 0,
        pricePerKg:        c.costSnapshotPerKg != null ? Number(c.costSnapshotPerKg) : null,
        totalCost:         c.calculatedCost    != null ? Number(c.calculatedCost)   : null,
        assemblyRevisionId: asm.releasedRevisionId ?? null,
      })
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
