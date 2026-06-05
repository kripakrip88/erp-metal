const bus        = require('../../core/events/event-bus')
const eventLog   = require('../../core/events/event-log.service')
const { ORDER_CREATED, PRODUCTION_ORDER_CREATED } = require('../../core/events/event-types')

bus.on(ORDER_CREATED, async (event) => {
  console.log('[production] Создание производственного задания для заказа:', event.payload?.orderNumber)

  await eventLog.logEvent({
    correlationId: event.correlationId,
    type:    PRODUCTION_ORDER_CREATED,
    source:  'production',
    payload: { orderId: event.payload?.id, createdAt: new Date().toISOString() },
  })
})
