const { json }      = require('../utils/response')
const { parseBody } = require('../utils/parseBody')
const { createPart } = require('../services/orderService')
const { validateCreatePart } = require('../validators/partValidator')

module.exports = [
  { method: 'POST', pathname: '/api/orders/:orderId/assemblies/:assemblyId/parts', handler: async (req, res, params) => {
    const body = await parseBody(req)
    const data = validateCreatePart(body)
    json(res, await createPart(params.assemblyId, data), 201)
  }},
]
