const prisma = require('../repositories/prisma')

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase()
}

async function createAssembliesFromResults(tx, orderId, normalizationResults) {
  const groups = new Map()
  for (const item of normalizationResults) {
    const key = item.assembly_name || 'Основной узел'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  let asmPos = 0
  for (const [asmName, items] of groups) {
    const assembly = await tx.assembly.create({
      data: { orderId, name: asmName, qty: 1, position: asmPos++ },
    })
    let partPos = 0
    for (const item of items) {
      const aiStatus = item.status === 'confirmed' || item.status === 'replaced'
        ? item.status
        : item.status === 'no_match' ? 'no_match' : 'pending'
      await tx.part.create({
        data: {
          assemblyId:           assembly.id,
          materialDefinitionId: item.confirmed_material_erp_id || null,
          name:                 item.confirmed_material_name || item.raw_text || null,
          measurementType:      'LINEAR',
          quantity:             Math.max(1, Math.round(item.quantity || 1)),
          position:             partPos++,
          aiGenerated:          true,
          aiRawText:            item.raw_text || null,
          aiNormResultId:       item.normalization_result_id || null,
          aiConfidence:         item.confidence != null ? item.confidence : null,
          aiMatchMethod:        item.match_method || null,
          aiStatus,
        },
      })
    }
  }
}

// Creates a DRAFT order from an inbound email.
// Idempotent on messageId: returns existing order.
// If existing order has no assemblies and normalizationResults provided, adds them retroactively.
async function createOrderFromEmail({ messageId, title, fromAddress, fromName, subject, actorId, companyId, normalizationResults }) {
  const email = normalizeEmail(fromAddress)

  // Idempotency: if this email already spawned an order, return it
  const existing = await prisma.interaction.findUnique({
    where:   { emailMessageId: messageId },
    include: { order: { select: { id: true, orderNumber: true } } },
  })
  if (existing?.orderId) {
    // Retroactively add assemblies if the order was created before AI parts existed
    if (Array.isArray(normalizationResults) && normalizationResults.length > 0) {
      const asmCount = await prisma.assembly.count({ where: { orderId: existing.orderId } })
      if (asmCount === 0) {
        await prisma.$transaction(tx => createAssembliesFromResults(tx, existing.orderId, normalizationResults))
      }
    }
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

    // 5. Create Assembly + Parts from normalization results (if provided)
    if (Array.isArray(normalizationResults) && normalizationResults.length > 0) {
      await createAssembliesFromResults(tx, order.id, normalizationResults)
    }

    return { orderId: order.id, orderNumber: order.orderNumber, customerId: customer.id }
  })

  return { ...result, created: true }
}

module.exports = { createOrderFromEmail }
