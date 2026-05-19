const prisma     = require('../repositories/prisma')
const { getCompany } = require('../utils/company')

async function listInteractions(customerId, { limit = 50 } = {}) {
  return prisma.interaction.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: Number(limit),
    include: {
      contact:   { select: { name: true } },
      order:     { select: { orderNumber: true, title: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  })
}

async function createInteraction(data) {
  let createdById = data.createdById
  if (!createdById) {
    const company = await getCompany()
    if (!company) throw new Error('Company not found')
    const user = await prisma.user.findFirst({ where: { companyId: company.id, isActive: true } })
    if (!user) throw new Error('No active user found')
    createdById = user.id
  }
  return prisma.interaction.create({
    data: {
      customerId:     data.customerId,
      contactId:      data.contactId      || null,
      orderId:        data.orderId        || null,
      type:           data.type,
      direction:      data.direction,
      subject:        data.subject        || null,
      body:           data.body           || null,
      emailMessageId: data.emailMessageId || null,
      createdById,
    },
  })
}

module.exports = { listInteractions, createInteraction }
