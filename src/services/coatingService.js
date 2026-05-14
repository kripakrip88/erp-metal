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
  return prisma.assemblyCoating.create({
    data: {
      assemblyId,
      coatingMaterialId: data.coatingMaterialId,
      layerNumber,
      autoAreaLink:    data.autoAreaLink  ?? true,
      manualAreaM2:    data.manualAreaM2  ?? null,
      selectedDftMkm:  data.selectedDftMkm ?? null,
      dilutionPercent: data.dilutionPercent ?? null,
      notes:           data.notes ?? null,
      position,
    },
    include: { coatingMaterial: true },
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
}
