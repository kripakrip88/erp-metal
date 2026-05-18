const prisma = require('../repositories/prisma')

async function getCompany() {
  return prisma.company.findFirst()
}

async function getCompanyId() {
  const c = await prisma.company.findFirst({ select: { id: true } })
  if (!c) throw new Error('Company not found')
  return c.id
}

module.exports = { getCompany, getCompanyId }
