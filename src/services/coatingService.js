const prisma = require('../repositories/prisma')

async function _companyId() {
  const c = await prisma.company.findFirst()
  if (!c) throw new Error('Company not found')
  return c.id
}

// ─── Coating Material catalog ─────────────────────────────────────────────

async function listCoatingMaterials() {
  const companyId = await _companyId()
  return prisma.coatingMaterial.findMany({
    where: { companyId, isActive: true },
    orderBy: [{ coatingType: 'asc' }, { code: 'asc' }],
  })
}

async function createCoatingMaterial(data) {
  const companyId = await _companyId()
  return prisma.coatingMaterial.create({
    data: { companyId, ...data },
  })
}

async function updateCoatingMaterial(id, data) {
  return prisma.coatingMaterial.update({ where: { id }, data })
}

// ─── Assembly coatings ────────────────────────────────────────────────────

async function listAssemblyCoatings(assemblyId) {
  return prisma.assemblyCoating.findMany({
    where: { assemblyId },
    include: { coatingMaterial: true },
    orderBy: { position: 'asc' },
  })
}

async function createAssemblyCoating(assemblyId, data) {
  const last = await prisma.assemblyCoating.findFirst({
    where: { assemblyId },
    orderBy: { position: 'desc' },
  })
  const position = last ? last.position + 1 : 0
  const layerNumber = data.layerNumber ?? (last ? last.layerNumber + 1 : 1)

  // Resolve snapshot fields from material if not provided
  let materialCodeSnapshot = data.materialCodeSnapshot ?? null
  let materialNameSnapshot = data.materialNameSnapshot ?? null
  if (!materialCodeSnapshot || !materialNameSnapshot) {
    const mat = await prisma.coatingMaterial.findUnique({
      where: { id: data.coatingMaterialId },
      select: { code: true, name: true },
    })
    materialCodeSnapshot = mat?.code ?? null
    materialNameSnapshot = mat?.name ?? null
  }

  return prisma.assemblyCoating.create({
    data: {
      assemblyId,
      coatingMaterialId:    data.coatingMaterialId,
      coatingSystemId:      data.coatingSystemId    ?? null,
      layerNumber,
      autoAreaLink:         data.autoAreaLink        ?? true,
      manualAreaM2:         data.manualAreaM2        ?? null,
      selectedDftMkm:       data.selectedDftMkm      ?? null,
      dilutionPercent:      data.dilutionPercent      ?? null,
      notes:                data.notes               ?? null,
      position,
      materialCodeSnapshot,
      materialNameSnapshot,
    },
    include: { coatingMaterial: true },
  })
}

async function applyCoatingSystem(assemblyId, coatingSystemId, options = {}) {
  const replaceExisting = options.replaceExisting ?? false

  return prisma.$transaction(async (tx) => {
    // Verify assembly exists and capture companyId for cross-tenant guard
    const assembly = await tx.assembly.findUnique({
      where: { id: assemblyId },
      select: { id: true, order: { select: { companyId: true } } },
    })
    if (!assembly) throw new Error('Assembly not found')

    const system = await tx.coatingSystem.findUnique({
      where: { id: coatingSystemId },
      include: {
        layers: {
          include: { coatingMaterial: true },
          orderBy: { position: 'asc' },
        },
      },
    })
    if (!system) throw new Error('CoatingSystem not found')
    if (!system.isActive) throw new Error('CoatingSystem is inactive')

    // Cross-company guard: system and assembly must belong to the same tenant
    if (system.companyId !== assembly.order.companyId) {
      throw new Error('CoatingSystem does not belong to the same company as the assembly')
    }

    if (replaceExisting) {
      await tx.assemblyCoating.deleteMany({ where: { assemblyId } })
    }
    // replaceExisting=false: new layers are appended, existing ones preserved

    // Single aggregate: get both max position and max layerNumber in one query
    const maxes = replaceExisting ? null : await tx.assemblyCoating.aggregate({
      where: { assemblyId },
      _max: { position: true, layerNumber: true },
    })
    const posOffset   = maxes?._max.position    != null ? maxes._max.position    + 1 : 0
    const layerOffset = maxes?._max.layerNumber != null ? maxes._max.layerNumber      : 0

    // Create independent runtime copies — snapshot origin, not live references
    const rows = system.layers.map(layer => ({
      assemblyId,
      coatingMaterialId:    layer.coatingMaterialId,
      coatingSystemId,
      layerNumber:          layerOffset + layer.layerNumber,
      autoAreaLink:         true,
      manualAreaM2:         null,
      selectedDftMkm:       layer.defaultDftMkm          ?? null,
      dilutionPercent:      layer.defaultDilutionPercent  ?? null,
      notes:                layer.notes                   ?? null,
      position:             posOffset + layer.position,
      materialCodeSnapshot: layer.coatingMaterial.code,
      materialNameSnapshot: layer.coatingMaterial.name,
    }))

    await tx.assemblyCoating.createMany({ data: rows })

    return tx.assemblyCoating.findMany({
      where: { assemblyId },
      include: { coatingMaterial: true },
      orderBy: { position: 'asc' },
    })
  })
}

async function updateAssemblyCoating(coatingId, data) {
  return prisma.assemblyCoating.update({
    where: { id: coatingId },
    data: {
      coatingMaterialId: data.coatingMaterialId,
      layerNumber:       data.layerNumber,
      autoAreaLink:      data.autoAreaLink,
      manualAreaM2:      data.manualAreaM2    ?? null,
      selectedDftMkm:    data.selectedDftMkm  ?? null,
      dilutionPercent:   data.dilutionPercent  ?? null,
      notes:             data.notes ?? null,
    },
    include: { coatingMaterial: true },
  })
}

async function deleteAssemblyCoating(coatingId) {
  return prisma.assemblyCoating.delete({ where: { id: coatingId } })
}

module.exports = {
  listCoatingMaterials, createCoatingMaterial, updateCoatingMaterial,
  listAssemblyCoatings, createAssemblyCoating, updateAssemblyCoating, deleteAssemblyCoating,
  applyCoatingSystem,
}
