const prisma = require('../repositories/prisma')

async function listContacts(customerId) {
  return prisma.contact.findMany({ where: { customerId }, orderBy: { name: 'asc' } })
}

async function createContact(customerId, data) {
  return prisma.contact.create({
    data: {
      customerId,
      name:     data.name,
      phone:    data.phone    || null,
      email:    data.email    || null,
      position: data.position || null,
      notes:    data.notes    || null,
    },
  })
}

async function updateContact(id, data) {
  return prisma.contact.update({
    where: { id },
    data: {
      name:     data.name     ?? undefined,
      phone:    data.phone    ?? undefined,
      email:    data.email    ?? undefined,
      position: data.position ?? undefined,
      notes:    data.notes    ?? undefined,
    },
  })
}

async function deleteContact(id) {
  return prisma.contact.delete({ where: { id } })
}

module.exports = { listContacts, createContact, updateContact, deleteContact }
