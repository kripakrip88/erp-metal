const prisma = require('./prisma')

async function findAll({ search, profileType, categoryId, companyId }) {
  const where = {
    companyId, isActive: true, deletedAt: null,
    ...(profileType  ? { profileType }         : {}),
    ...(categoryId   ? { categoryId }           : {}),
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

module.exports = { findAll, findById }
