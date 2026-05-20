const prisma     = require('../repositories/prisma')
const { getCompany } = require('../utils/company')

async function listCustomers({ search, email } = {}) {
  const company = await getCompany()
  if (!company) return []
  const where = { companyId: company.id, deletedAt: null }
  if (search) where.name = { contains: search, mode: 'insensitive' }
  if (email)  where.email = { contains: email, mode: 'insensitive' }
  return prisma.customer.findMany({
    where,
    include: {
      contacts: { take: 5 },
      _count: { select: { orders: true, interactions: true } },
    },
    orderBy: [{ priority: 'asc' }, { name: 'asc' }],
  })
}

async function getCustomer(id) {
  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      contacts: true,
      interactions: {
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          contact:   { select: { name: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })
  if (!customer) return null

  // Include orders linked by FK *or* matching by name (for phone-created orders without customerId)
  const orders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      OR: [
        { customerId: id },
        { customerId: null, customerName: { equals: customer.name, mode: 'insensitive' } },
      ],
    },
    take: 30,
    orderBy: { createdAt: 'desc' },
    select: { id: true, orderNumber: true, title: true, status: true, createdAt: true, customerId: true },
  })

  return { ...customer, orders }
}

async function createCustomer(data) {
  const company = await getCompany()
  if (!company) throw new Error('Company not found')
  return prisma.customer.create({
    data: {
      companyId: company.id,
      name:      data.name,
      inn:       data.inn      || null,
      phone:     data.phone    || null,
      email:     data.email    || null,
      website:   data.website  || null,
      notes:     data.notes    || null,
      priority:  data.priority || 'NORMAL',
    },
  })
}

async function updateCustomer(id, data) {
  return prisma.customer.update({
    where: { id },
    data: {
      name:     data.name,
      inn:      data.inn      ?? undefined,
      phone:    data.phone    ?? undefined,
      email:    data.email    ?? undefined,
      website:  data.website  ?? undefined,
      notes:    data.notes    ?? undefined,
      priority: data.priority ?? undefined,
    },
  })
}

async function deleteCustomer(id) {
  return prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } })
}

module.exports = { listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer }
