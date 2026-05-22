const { json }        = require('../utils/response')
const { parseBody }   = require('../utils/parseBody')
const { requireRole } = require('../middleware/requireRole')
const { createPart }  = require('../services/orderService')
const { validateCreatePart } = require('../validators/partValidator')

const canWrite = requireRole('ENGINEER', 'MANAGER', 'ADMIN')

module.exports = [
  { method: 'POST', pathname: '/api/orders/:orderId/assemblies/:assemblyId/parts', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    const data = validateCreatePart(body)
    json(res, await createPart(params.assemblyId, data), 201)
  }},
]
