const materialRepo = require('../repositories/materialRepo')
const prisma = require('../repositories/prisma')

async function getCompany() {
  return prisma.company.findFirst()
}

async function listMaterials({ search, profileType }) {
  const company = await getCompany()
  if (!company) return []
  return materialRepo.findAll({ search, profileType, companyId: company.id })
}

async function getMaterial(id) {
  return materialRepo.findById(id)
}

module.exports = { listMaterials, getMaterial }
