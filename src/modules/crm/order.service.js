const eventLog              = require('../../core/events/event-log.service')
const { ORDER_CREATED }     = require('../../core/events/event-types')

async function createOrder(data) {
  const order = {
    id:          crypto.randomUUID(),
    orderNumber: data.orderNumber ?? `ORD-${Date.now()}`,
    ...data,
    createdAt:   new Date().toISOString(),
  }

  await eventLog.logEvent({
    type:    ORDER_CREATED,
    source:  'crm',
    payload: order,
  })

  return order
}

module.exports = { createOrder }
