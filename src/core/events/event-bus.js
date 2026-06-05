const EventEmitter = require('eventemitter2')

const bus = new EventEmitter({ wildcard: true })

module.exports = {
  emit: (type, payload) => bus.emit(type, payload),
  on:   (type, handler) => bus.on(type, handler),
}
