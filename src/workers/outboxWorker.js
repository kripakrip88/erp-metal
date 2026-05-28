const prisma          = require('../repositories/prisma')
const { dispatch }    = require('./eventHandlers')

const POLL_MS    = 2000
const BATCH_SIZE = 20
const MAX_RETRY  = 3

async function processBatch() {
  const events = await prisma.outboxEvent.findMany({
    where: {
      processedAt: null,
      retryCount:  { lt: MAX_RETRY },
    },
    orderBy: { createdAt: 'asc' },
    take:    BATCH_SIZE,
  })

  for (const event of events) {
    try {
      await dispatch(event)
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data:  { processedAt: new Date() },
      })
    } catch (err) {
      console.error(`[outbox] event ${event.id} (${event.eventType}) failed:`, err.message)
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          retryCount: { increment: 1 },
          failedAt:   new Date(),
          error:      err.message,
        },
      })
    }
  }
}

function startOutboxWorker() {
  console.log('[outbox] Worker started — polling every', POLL_MS, 'ms')
  setInterval(async () => {
    try {
      await processBatch()
    } catch (err) {
      console.error('[outbox] Batch error:', err.message)
    }
  }, POLL_MS)
}

module.exports = { startOutboxWorker }
