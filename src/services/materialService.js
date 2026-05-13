const materialRepo = require('../repositories/materialRepo')
const prisma = require('../repositories/prisma')

async function getCompany() {
  return prisma.company.findFirst()
}

async function listMaterials({ search, profileType, categoryId }) {
  const company = await getCompany()
  if (!company) return []
  return materialRepo.findAll({ search, profileType, categoryId, companyId: company.id })
}

async function getMaterial(id) {
  return materialRepo.findById(id)
}

async function createMaterial(data) {
  const company = await getCompany()
  if (!company) throw new Error('Company not found')
  return materialRepo.create({ companyId: company.id, ...data })
}

async function updateMaterial(id, data) {
  return materialRepo.update(id, data)
}

async function archiveMaterial(id) {
  return materialRepo.archive(id)
}

module.exports = { listMaterials, getMaterial, createMaterial, updateMaterial, archiveMaterial }
