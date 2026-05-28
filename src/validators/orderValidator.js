const { optionalStr } = require('./common')

function validateCreateOrder(body) {
  return {
    orderNumber:  optionalStr(body.orderNumber) || null,
    customerId:   body.customerId   || null,
    customerName: optionalStr(body.customerName) || '',
    title:        optionalStr(body.title) || null,
    description:  optionalStr(body.description),
    mode:         body.mode || 'STANDARD',
  }
}

module.exports = { validateCreateOrder }
