const prisma = require('../repositories/prisma')

async function getCompany() {
  const c = await prisma.company.findFirst()
  if (!c) throw Object.assign(new Error('Company not found'), { status: 500 })
  return c
}

async function getCompanyId() {
  const c = await prisma.company.findFirst({ select: { id: true } })
  if (!c) throw new Error('Company not found')
  return c.id
}

module.exports = { getCompany, getCompanyId }
