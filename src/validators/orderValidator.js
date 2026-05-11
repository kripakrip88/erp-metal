const { required, optionalStr } = require('./common')

function validateCreateOrder(body) {
  return {
    orderNumber:  body.orderNumber || `ORD-${Date.now()}`,
    customerName: required(body.customerName, 'customerName'),
    title:        required(body.title, 'title'),
    description:  optionalStr(body.description),
    mode:         body.mode || 'STANDARD',
  }
}

module.exports = { validateCreateOrder }
