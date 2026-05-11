const { json }      = require('../utils/response')
const { parseBody } = require('../utils/parseBody')
const { createAssembly } = require('../services/orderService')

module.exports = [
  { method: 'POST', pathname: '/api/orders/:orderId/assemblies', handler: async (req, res, params) => {
    const body = await parseBody(req)
    json(res, await createAssembly(params.orderId, body), 201)
  }},
]
