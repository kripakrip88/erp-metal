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
    // Verify assembly exists before any writes
    const assembly = await tx.assembly.findUnique({
      where: { id: assemblyId },
      select: { id: true },
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

    if (replaceExisting) {
      await tx.assemblyCoating.deleteMany({ where: { assemblyId } })
    }
    // replaceExisting=false: new layers are appended, existing ones preserved

    // Resolve next position to avoid collisions when appending
    const last = replaceExisting ? null : await tx.assemblyCoating.findFirst({
      where: { assemblyId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const posOffset = last ? last.position + 1 : 0

    // Create independent runtime copies — snapshot origin, not live references
    const rows = system.layers.map(layer => ({
      assemblyId,
      coatingMaterialId:    layer.coatingMaterialId,
      coatingSystemId,
      layerNumber:          layer.layerNumber,
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
