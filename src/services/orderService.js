const orderRepo = require('../repositories/orderRepo')
const prisma    = require('../repositories/prisma')
const {
  LOCKED_ORDER_STATUSES,
  TOPOLOGY_LOCKED_STATUSES,
  assertOrderStructureMutable,
  assertAssemblyStructureMutable,
} = require('./orderIntegrityService')
const { AUDIT_EVENTS, safeAudit } = require('./auditService')

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
  try {
    await assertOrderStructureMutable(orderId)
  } catch (err) {
    safeAudit({
      eventType:  AUDIT_EVENTS.STRUCTURE_MUTATION_BLOCKED,
      entityType: 'ORDER',
      entityId:   orderId,
      orderId,
      payload:    { reason: err.message, operation: 'createAssembly' },
    })
    throw err
  }
  const asm = await prisma.assembly.create({ data: {
    orderId,
    name:        data.name,
    description: data.description || null,
    qty:         data.qty != null ? parseInt(data.qty) : 1,
    position:    data.position || 0,
  }})
  safeAudit({
    eventType:  AUDIT_EVENTS.ASSEMBLY_CREATED,
    entityType: 'ASSEMBLY',
    entityId:   asm.id,
    orderId,
    assemblyId: asm.id,
    payload:    { name: asm.name, qty: asm.qty, position: asm.position },
  })
  return asm
}

// Released assemblies are structurally immutable.
// Never mutate fabrication topology after release.
async function clearAssemblies(orderId) {
  const result = await prisma.$transaction(async (tx) => {
    // Re-check inside transaction for TOCTOU safety
    const order = await tx.order.findUnique({
      where:  { id: orderId },
      select: { status: true },
    })
    if (!order) throw new Error('Order not found')
    if (TOPOLOGY_LOCKED_STATUSES.includes(order.status)) {
      throw new Error(`Order structure is locked in production lifecycle (${order.status})`)
    }

    // Hard block: any assembly with a released revision is structurally frozen.
    // Clearing after release would silently destroy the production baseline.
    const releasedAsm = await tx.assembly.findFirst({
      where:  { orderId, releasedRevisionId: { not: null } },
      select: { name: true },
    })
    if (releasedAsm) {
      throw new Error(
        `Cannot clear assemblies — "${releasedAsm.name}" has a released revision`
      )
    }

    const asms   = await tx.assembly.findMany({ where: { orderId }, select: { id: true } })
    const asmIds = asms.map(a => a.id)
    if (asmIds.length === 0) return { deleted: 0 }

    // Explicit FK-safe deletion order — Assembly ↔ AssemblyRevision circular FK requires
    // pointer nullification before revision rows can be deleted.
    await tx.assemblyRevisionCoatingSnapshot.deleteMany({
      where: { assemblyRevision: { assemblyId: { in: asmIds } } },
    })
    await tx.assembly.updateMany({
      where: { id: { in: asmIds } },
      data:  { currentRevisionId: null, releasedRevisionId: null },
    })
    await tx.assemblyRevision.deleteMany({ where: { assemblyId: { in: asmIds } } })
    await tx.assemblyCoating.deleteMany({ where: { assemblyId: { in: asmIds } } })
    await tx.part.deleteMany({ where: { assemblyId: { in: asmIds } } })
    await tx.assembly.deleteMany({ where: { id: { in: asmIds } } })

    return { deleted: asmIds.length }
  })
  safeAudit({
    eventType:  AUDIT_EVENTS.ASSEMBLY_CLEARED,
    entityType: 'ORDER',
    entityId:   orderId,
    orderId,
    payload:    { deletedCount: result.deleted },
  })
  return result
}

async function createPart(assemblyId, data) {
  try {
    await assertAssemblyStructureMutable(assemblyId)
  } catch (err) {
    safeAudit({
      eventType:  AUDIT_EVENTS.STRUCTURE_MUTATION_BLOCKED,
      entityType: 'ASSEMBLY',
      entityId:   assemblyId,
      assemblyId,
      payload:    { reason: err.message, operation: 'createPart' },
    })
    throw err
  }
  const part = await prisma.part.create({ data: {
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
  safeAudit({
    eventType:  AUDIT_EVENTS.PART_CREATED,
    entityType: 'PART',
    entityId:   part.id,
    assemblyId,
    payload:    { assemblyId, materialDefinitionId: part.materialDefinitionId, quantity: part.quantity },
  })
  return part
}

module.exports = { listOrders, getOrder, createOrder, createAssembly, clearAssemblies, createPart }
