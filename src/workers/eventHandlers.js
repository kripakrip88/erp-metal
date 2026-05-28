const handlers = {}

function register(eventType, handlerFn) {
  handlers[eventType] = handlerFn
}

async function dispatch(event) {
  const handler = handlers[event.eventType]
  if (handler) {
    await handler(event)
  }
}

module.exports = { register, dispatch }
