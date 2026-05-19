const prisma = require('./prisma')

async function findAll(companyId) {
  return prisma.order.findMany({
    where: { companyId, deletedAt: null },
    include: { _count: { select: { assemblies: true, revisions: true } } },
    orderBy: { createdAt: 'desc' }
  })
}

async function findById(id) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      assemblies: { orderBy: { position: 'asc' }, include: {
        parts: { orderBy: { position: 'asc' }, include: {
          materialDefinition: { include: { geometry: true } }
        }},
        coatings: { orderBy: { position: 'asc' } },
      }},
      revisions: { orderBy: { revisionNumber: 'desc' } }
    }
  })
}

async function findWithParts(id) {
  return prisma.order.findUnique({
    where: { id },
    include: { assemblies: { include: { parts: { include: {
      materialDefinition: { include: { geometry: true,
        procurementProfiles: { include: {
          prices: { where: { validTo: null }, orderBy: { validFrom: 'desc' }, take: 1 }
        }}
      }}
    }}}}}
  })
}

async function create(data) {
  return prisma.order.create({ data })
}

module.exports = { findAll, findById, findWithParts, create }
