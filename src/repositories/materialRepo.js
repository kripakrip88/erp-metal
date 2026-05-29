const prisma = require('./prisma')

async function findAll({ search, profileType, categoryId, materialDomain, companyId,
  fastener_type, diameter_mm, coating, strength_class, din, thread_type, length_mm,
  page, limit, sortBy, sortDir }) {

  const pageNum  = Math.max(1, parseInt(page)  || 1)
  const pageSize = Math.min(200, Math.max(1, parseInt(limit) || 50))
  const skip     = (pageNum - 1) * pageSize

  const SORTABLE = { diameter_mm: 'diameterMm', length_mm: 'lengthMm', strength_class: 'strengthClass', name: 'name', code: 'code' }
  const orderField = SORTABLE[sortBy] || null
  const orderDir   = sortDir === 'desc' ? 'desc' : 'asc'

  const where = {
    companyId, isActive: true, deletedAt: null,
    ...(profileType    ? { profileType }                                          : {}),
    ...(categoryId     ? { categoryId }                                           : {}),
    ...(materialDomain ? { materialDomain: { in: materialDomain.split(',') } }    : {}),
    ...(fastener_type  ? { fastenerType: fastener_type }                          : {}),
    ...(diameter_mm    ? { diameterMm: parseFloat(diameter_mm) }                  : {}),
    ...(length_mm      ? { lengthMm: parseFloat(length_mm) }                      : {}),
    ...(coating        ? { coating: { contains: coating, mode: 'insensitive' } }  : {}),
    ...(strength_class ? { strengthClass: strength_class }                        : {}),
    ...(din            ? { standard: { contains: din, mode: 'insensitive' } }     : {}),
    ...(thread_type    ? { threadType: thread_type }                              : {}),
    ...(search ? { OR: [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ]} : {})
  }

  const [items, total] = await Promise.all([
    prisma.materialDefinition.findMany({
      where,
      include: { geometry: true, procurementProfiles: {
        where: { isActive: true },
        include: { prices: { where: { validTo: null }, orderBy: { validFrom: 'desc' }, take: 1 } }
      }},
      orderBy: orderField
        ? [{ [orderField]: orderDir }]
        : [{ profileType: 'asc' }, { code: 'asc' }],
      skip,
      take: pageSize,
    }),
    prisma.materialDefinition.count({ where }),
  ])

  return { items, total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) }
}

async function findById(id) {
  return prisma.materialDefinition.findUnique({
    where: { id },
    include: { geometry: true, procurementProfiles: { include: { prices: true } } }
  })
}

async function create({ companyId, code, name, materialType, profileType, materialDomain, steelGrade, categoryId, standard, strengthClass, pieceUnit, measurementType, theoreticalWeightPerMeter, weightPerSquareMeter, paintSurfacePerMeter, unitWeightKg, gost, fastenerType, diameterMm, lengthMm, threadType, coating, weightRequired, weightNote }) {
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
        gost:          gost          ?? null,
        fastenerType:  fastenerType  ?? null,
        diameterMm:    diameterMm    ?? null,
        lengthMm:      lengthMm      ?? null,
        threadType:    threadType    ?? null,
        coating:       coating       ?? null,
        weightRequired: weightRequired ?? false,
        weightNote:    weightNote    ?? null,
        geometryId:    geo.id,
      },
      include: { geometry: true, procurementProfiles: { where: { isActive: true }, include: { prices: { where: { validTo: null }, orderBy: { validFrom: 'desc' }, take: 1 } } } }
    })
  })
}

async function update(id, { code, name, materialType, profileType, materialDomain, steelGrade, categoryId, standard, strengthClass, pieceUnit, measurementType, theoreticalWeightPerMeter, weightPerSquareMeter, paintSurfacePerMeter, unitWeightKg, gost, fastenerType, diameterMm, lengthMm, threadType, coating, weightRequired, weightNote }) {
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
        gost:          gost          ?? null,
        fastenerType:  fastenerType  ?? null,
        diameterMm:    diameterMm    ?? null,
        lengthMm:      lengthMm      ?? null,
        threadType:    threadType    ?? null,
        coating:       coating       ?? null,
        weightRequired: weightRequired ?? false,
        weightNote:    weightNote    ?? null,
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

async function findFastenerFilterOptions({ companyId, fastenerType }) {
  const where = { companyId, isActive: true, deletedAt: null, materialDomain: 'FASTENER',
    ...(fastenerType ? { fastenerType } : {}) }

  const rows = await prisma.materialDefinition.findMany({
    where,
    select: { diameterMm: true, lengthMm: true, coating: true, strengthClass: true, standard: true, threadType: true, fastenerType: true }
  })

  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => {
    const na = parseFloat(a), nb = parseFloat(b)
    return !isNaN(na) && !isNaN(nb) ? na - nb : String(a).localeCompare(String(b))
  })

  return {
    fastener_types:   uniq(rows.map(r => r.fastenerType)),
    diameter_mm:      uniq(rows.map(r => r.diameterMm != null ? String(r.diameterMm) : null)),
    length_mm:        uniq(rows.map(r => r.lengthMm    != null ? String(r.lengthMm)  : null)),
    coating:          uniq(rows.map(r => r.coating)),
    strength_class:   uniq(rows.map(r => r.strengthClass)),
    din:              uniq(rows.map(r => r.standard)),
    thread_type:      uniq(rows.map(r => r.threadType)),
  }
}

module.exports = { findAll, findById, create, update, archive, findFastenerFilterOptions }
