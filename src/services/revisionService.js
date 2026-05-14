const prisma   = require('../repositories/prisma')
const orderRepo = require('../repositories/orderRepo')
const { calcLinearWeight, calcAreaWeight } = require('../calculations/weightCalc')
const { calcLinearPaint, calcAreaPaint }   = require('../calculations/paintCalc')
const { calcMaterialCost }                 = require('../calculations/costCalc')

async function getRevisions(orderId) {
  return prisma.quoteRevision.findMany({
    where: { orderId },
    include: { parts: true, calculation: true },
    orderBy: { revisionNumber: 'desc' }
  })
}

async function createRevision(orderId, notes) {
  const company = await prisma.company.findFirst()
  const user    = await prisma.user.findFirst({ where: { companyId: company.id } })

  const last = await prisma.quoteRevision.findFirst({
    where: { orderId }, orderBy: { revisionNumber: 'desc' }
  })
  const revNum = (last?.revisionNumber || 0) + 1

  const order = await orderRepo.findWithParts(orderId)
  if (!order) throw new Error('Order not found')

  let totalWeight = 0, totalCost = 0, totalPaint = 0
  const revParts = []

  for (const asm of order.assemblies) {
    const asmQty = asm.qty || 1
    for (const part of asm.parts) {
      const mat    = part.materialDefinition
      const geo    = mat.geometry
      // TODO: MVP — берём первый профиль. Позже: учитывать isPreferred, validFrom/validTo, currency, regional pricing
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
        // TODO: PIECE defaults to 0 paint area. Future: paintable assemblies (закладные, окрашенные покупные изделия)
        paint  = 0
      }

      const cost = part.measurementType === 'PIECE' && ppp != null
        ? Math.round(part.quantity * asmQty * ppp * 10000) / 10000
        : calcMaterialCost(totalW, ppt)
      totalWeight += totalW
      totalCost   += cost
      totalPaint  += paint

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
        calculatedWeightPerUnit: wpu,
        totalWeight:   totalW,
        paintAreaM2:   paint,
        pricePerTon:   ppt,
        pricePerPiece: ppp ?? null,
        currency:      'RUB',
        materialCost:  cost,
        assemblyName:  asm.name,
      })
    }
  }

  return prisma.quoteRevision.create({
    data: {
      orderId, revisionNumber: revNum,
      createdById: user?.id || company.id,
      status: 'DRAFT', notes: notes || null, currency: 'RUB',
      parts: { create: revParts },
      calculation: { create: {
        calculationVersion: '2.0',
        totalWeightKg:    totalWeight,
        totalMaterialCost: totalCost,
        totalCost:        totalCost,
        totalPaintM2:     totalPaint,
        currency: 'RUB',
        materialSummary: {}, weightBreakdown: {},
        costBreakdown: {}, pricingSummary: {}, warnings: [],
      }}
    },
    include: { parts: true, calculation: true }
  })
}

module.exports = { getRevisions, createRevision }
