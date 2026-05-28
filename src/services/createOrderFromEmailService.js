const prisma = require('../repositories/prisma')

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase()
}

// Creates a DRAFT order from an inbound email.
// Idempotent: calling twice with the same emailMessageId returns the existing order.
async function createOrderFromEmail({ messageId, title, fromAddress, fromName, subject, actorId, companyId }) {
  const email = normalizeEmail(fromAddress)

  // Idempotency: if this email already spawned an order, return it
  const existing = await prisma.interaction.findUnique({
    where:   { emailMessageId: messageId },
    include: { order: { select: { id: true, orderNumber: true } } },
  })
  if (existing?.orderId) {
    return {
      orderId:     existing.orderId,
      orderNumber: existing.order?.orderNumber ?? null,
      customerId:  existing.customerId,
      created:     false,
    }
  }

  // Resolve companyId
  let resolvedCompanyId = companyId
  if (!resolvedCompanyId) {
    const company = await prisma.company.findFirst({ select: { id: true } })
    if (!company) throw new Error('Company not found')
    resolvedCompanyId = company.id
  }

  // Resolve actorId for audit trail
  let resolvedActorId = actorId
  if (!resolvedActorId) {
    const user = await prisma.user.findFirst({ where: { companyId: resolvedCompanyId, isActive: true }, select: { id: true } })
    resolvedActorId = user?.id ?? null
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Find or create customer by normalized email
    let customer = await tx.customer.findFirst({
      where: { companyId: resolvedCompanyId, email, deletedAt: null },
      select: { id: true, name: true },
    })

    if (!customer) {
      customer = await tx.customer.create({
        data: {
          companyId: resolvedCompanyId,
          name:      fromName || email,
          email,
          priority:  'NORMAL',
        },
        select: { id: true, name: true },
      })
    }

    // 2. Create DRAFT order
    const orderNumber = `RFQ-${Date.now()}`
    const order = await tx.order.create({
      data: {
        companyId:    resolvedCompanyId,
        createdById:  resolvedActorId || resolvedCompanyId,
        customerId:   customer.id,
        customerName: customer.name,
        orderNumber,
        title:        title || subject || `RFQ от ${fromName || email}`,
        status:       'DRAFT',
        mode:         'STANDARD',
      },
      select: { id: true, orderNumber: true },
    })

    // 3. Create Interaction linking email → customer → order
    await tx.interaction.create({
      data: {
        customerId:     customer.id,
        orderId:        order.id,
        type:           'EMAIL',
        direction:      'INBOUND',
        subject,
        body:           `От: ${fromName || ''} <${fromAddress}>\nТема: ${subject || ''}`,
        emailMessageId: messageId,
        createdById:    resolvedActorId || resolvedCompanyId,
      },
    })

    // 4. Emit outbox event for downstream handlers
    await tx.outboxEvent.create({
      data: {
        companyId:     resolvedCompanyId,
        eventType:     'RFQ_CREATED_FROM_EMAIL',
        aggregateType: 'Order',
        aggregateId:   order.id,
        payload:       { orderId: order.id, customerId: customer.id, messageId, fromAddress, subject },
      },
    })

    return { orderId: order.id, orderNumber: order.orderNumber, customerId: customer.id }
  })

  return { ...result, created: true }
}

module.exports = { createOrderFromEmail }
