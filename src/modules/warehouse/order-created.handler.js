const bus        = require('../../core/events/event-bus')
const eventLog   = require('../../core/events/event-log.service')
const { ORDER_CREATED, WAREHOUSE_STOCK_RESERVED } = require('../../core/events/event-types')

bus.on(ORDER_CREATED, async (event) => {
  console.log('[warehouse] Резервирование материалов для заказа:', event.payload?.orderNumber)

  await eventLog.logEvent({
    correlationId: event.correlationId,
    type:    WAREHOUSE_STOCK_RESERVED,
    source:  'warehouse',
    payload: { orderId: event.payload?.id, reservedAt: new Date().toISOString() },
  })
})
