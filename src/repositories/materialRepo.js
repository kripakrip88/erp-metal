const prisma = require('./prisma')

async function findAll({ search, profileType, categoryId, materialDomain, companyId }) {
  const where = {
    companyId, isActive: true, deletedAt: null,
    ...(profileType    ? { profileType }                                          : {}),
    ...(categoryId     ? { categoryId }                                           : {}),
    ...(materialDomain ? { materialDomain: { in: materialDomain.split(',') } }    : {}),
    ...(search ? { OR: [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ]} : {})
  }
  return prisma.materialDefinition.findMany({
    where,
    include: { geometry: true, procurementProfiles: {
      where: { isActive: true },
      include: { prices: { where: { validTo: null }, orderBy: { validFrom: 'desc' }, take: 1 } }
    }},
    orderBy: [{ profileType: 'asc' }, { code: 'asc' }],
  })
}

async function findById(id) {
  return prisma.materialDefinition.findUnique({
    where: { id },
    include: { geometry: true, procurementProfiles: { include: { prices: true } } }
  })
}

async function create({ companyId, code, name, materialType, profileType, materialDomain, steelGrade, categoryId, standard, strengthClass, pieceUnit, measurementType, theoreticalWeightPerMeter, weightPerSquareMeter, paintSurfacePerMeter, unitWeightKg }) {
  return prisma.$transaction(async (tx) => {
    const geo = await tx.materialGeometry.create({
      data: {
        measurementType,
        theoreticalWeightPerMeter: theoreticalWeightPerMeter ?? null,
        weightPerSquareMeter:      weightPerSquareMeter      ?? null,
        paintSurfacePerMeter:      paintSurfacePerMeter      ?? null,
        unitWeightKg:              unitWeightKg              ?? null,
      }
    })
    return tx.materialDefinition.create({
      data: {
        companyId, code, name, materialType, profileType,
        materialDomain: materialDomain ?? 'STRUCTURAL',
        steelGrade: steelGrade ?? null,
        categoryId: categoryId ?? null,
        standard:      standard      ?? null,
        strengthClass: strengthClass ?? null,
        pieceUnit:     pieceUnit     ?? null,
        geometryId:    geo.id,
      },
      include: { geometry: true, procurementProfiles: { where: { isActive: true }, include: { prices: { where: { validTo: null }, orderBy: { validFrom: 'desc' }, take: 1 } } } }
    })
  })
}

async function update(id, { code, name, materialType, profileType, materialDomain, steelGrade, categoryId, standard, strengthClass, pieceUnit, measurementType, theoreticalWeightPerMeter, weightPerSquareMeter, paintSurfacePerMeter, unitWeightKg }) {
  return prisma.$transaction(async (tx) => {
    const mat = await tx.materialDefinition.findUnique({ where: { id }, select: { geometryId: true } })
    if (!mat) throw new Error('Material not found')

    await tx.materialGeometry.update({
      where: { id: mat.geometryId },
      data: {
        // measurementType is readonly after creation
        theoreticalWeightPerMeter: theoreticalWeightPerMeter ?? null,
        weightPerSquareMeter:      weightPerSquareMeter      ?? null,
        paintSurfacePerMeter:      paintSurfacePerMeter      ?? null,
        unitWeightKg:              unitWeightKg              ?? null,
      }
    })

    return tx.materialDefinition.update({
      where: { id },
      data: {
        code, name, materialType, profileType,
        materialDomain: materialDomain ?? undefined,
        steelGrade:    steelGrade    ?? null,
        categoryId:    categoryId    ?? null,
        standard:      standard      ?? null,
        strengthClass: strengthClass ?? null,
        pieceUnit:     pieceUnit     ?? null,
      },
      include: { geometry: true, procurementProfiles: { where: { isActive: true }, include: { prices: { where: { validTo: null }, orderBy: { validFrom: 'desc' }, take: 1 } } } }
    })
  })
}

async function archive(id) {
  return prisma.materialDefinition.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  })
}

module.exports = { findAll, findById, create, update, archive }
