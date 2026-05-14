const prisma = require('./prisma')

async function findAll(companyId) {
  return prisma.productTemplate.findMany({
    where: { companyId, isActive: true, deletedAt: null },
    orderBy: { code: 'asc' },
  })
}

async function findById(id) {
  return prisma.productTemplate.findUnique({
    where: { id },
    include: {
      nodes: {
        where: { parentNodeId: null },
        orderBy: { position: 'asc' },
        include: {
          parts: { orderBy: { position: 'asc' } },
          children: {
            orderBy: { position: 'asc' },
            include: {
              parts: { orderBy: { position: 'asc' } },
              children: {
                orderBy: { position: 'asc' },
                include: {
                  parts: { orderBy: { position: 'asc' } },
                },
              },
            },
          },
        },
      },
    },
  })
}

async function create(data) {
  return prisma.productTemplate.create({ data })
}

async function update(id, data) {
  return prisma.productTemplate.update({ where: { id }, data })
}

async function softDelete(id) {
  return prisma.productTemplate.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  })
}

async function createNode(data) {
  return prisma.productTemplateNode.create({ data })
}

async function findNode(id) {
  return prisma.productTemplateNode.findUnique({ where: { id } })
}

async function updateNode(id, data) {
  return prisma.productTemplateNode.update({ where: { id }, data })
}

async function deleteNode(id) {
  return prisma.productTemplateNode.delete({ where: { id } })
}

async function createNodePart(data) {
  return prisma.productTemplateNodePart.create({ data })
}

async function updateNodePart(id, data) {
  return prisma.productTemplateNodePart.update({ where: { id }, data })
}

async function deleteNodePart(id) {
  return prisma.productTemplateNodePart.delete({ where: { id } })
}

module.exports = {
  findAll, findById, create, update, softDelete,
  createNode, findNode, updateNode, deleteNode,
  createNodePart, updateNodePart, deleteNodePart,
}
