const prisma        = require('../../repositories/prisma')
const bus           = require('./event-bus')
const correlationId = require('./correlation-id')

async function logEvent({ id, correlationId: cid, type, source, payload }) {
  const eventId = id ?? crypto.randomUUID()
  const corrId  = cid ?? correlationId.getCurrent()

  const record = await prisma.eventLog.create({
    data: {
      id:            eventId,
      correlationId: corrId,
      eventType:     type,
      source,
      payload,
      status: 'PENDING',
    },
  })

  console.log(`[event] type=${type} source=${source} correlationId=${corrId}`)

  try {
    bus.emit(type, { id: eventId, correlationId: corrId, type, source, payload })

    await prisma.eventLog.update({
      where: { id: record.id },
      data:  { status: 'PROCESSED', processedAt: new Date() },
    })
  } catch (err) {
    await prisma.eventLog.update({
      where: { id: record.id },
      data:  { status: 'FAILED', error: err.message },
    })
    throw err
  }
}

module.exports = { logEvent }
