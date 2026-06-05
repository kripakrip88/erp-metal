const { AsyncLocalStorage } = require('async_hooks')

const storage = new AsyncLocalStorage()

module.exports = {
  run: (fn) => storage.run({ correlationId: crypto.randomUUID() }, fn),
  getCurrent: () => storage.getStore()?.correlationId ?? crypto.randomUUID(),
}
