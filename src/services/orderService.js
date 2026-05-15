const orderRepo = require('../repositories/orderRepo')
const prisma    = require('../repositories/prisma')

async function getCompany() {
  return prisma.company.findFirst()
}

async function listOrders() {
  const company = await getCompany()
  if (!company) return []
  return orderRepo.findAll(company.id)
}

async function getOrder(id) {
  return orderRepo.findById(id)
}

async function createOrder(data) {
  const company = await getCompany()
  if (!company) throw new Error('Company not found')
  const user = await prisma.user.findFirst({ where: { companyId: company.id } })
  return orderRepo.create({
    companyId:    company.id,
    createdById:  user?.id || company.id,
    orderNumber:  data.orderNumber,
    customerName: data.customerName,
    title:        data.title,
    description:  data.description || null,
    status:       'DRAFT',
    mode:         data.mode || 'STANDARD',
  })
}

async function createAssembly(orderId, data) {
  return prisma.assembly.create({ data: {
    orderId,
    name:        data.name,
    description: data.description || null,
    qty:         data.qty != null ? parseInt(data.qty) : 1,
    position:    data.position || 0,
  }})
}

async function clearAssemblies(orderId) {
  // Delete parts first (FK constraint), then assemblies
  const asms = await prisma.assembly.findMany({ where: { orderId }, select: { id: true } })
  const asmIds = asms.map(a => a.id)
  if (asmIds.length > 0) {
    await prisma.part.deleteMany({ where: { assemblyId: { in: asmIds } } })
    await prisma.assembly.deleteMany({ where: { orderId } })
  }
  return { deleted: asmIds.length }
}

async function createPart(assemblyId, data) {
  return prisma.part.create({ data: {
    assemblyId,
    materialDefinitionId: data.materialDefinitionId,
    name:            data.name || null,
    measurementType: data.measurementType || 'LINEAR',
    length:          data.length          || null,
    sheetWidth:      data.sheetWidth      || null,
    sheetHeight:     data.sheetHeight     || null,
    directWeightKg:  data.directWeightKg  || null,
    quantity:        data.quantity || 1,
    notes:           data.notes || null,
    position:        data.position || 0,
  }})
}

// ─── 5.4.2 — Active quote pointer ─────────────────────────────────────────────

// Pins a QuoteRevision as the active quote for an order.
// Ownership check: quote must belong to the same order.
async function setActiveQuoteRevision(orderId, quoteRevisionId) {
  const qr = await prisma.quoteRevision.findUnique({
    where:  { id: quoteRevisionId },
    select: { orderId: true },
  })
  if (!qr) throw new Error('QuoteRevision not found')
  if (qr.orderId !== orderId) throw new Error('QuoteRevision does not belong to this order')
  return prisma.order.update({
    where:  { id: orderId },
    data:   { activeQuoteRevisionId: quoteRevisionId },
    select: { id: true, activeQuoteRevisionId: true },
  })
}

module.exports = { listOrders, getOrder, createOrder, createAssembly, clearAssemblies, createPart, setActiveQuoteRevision }
