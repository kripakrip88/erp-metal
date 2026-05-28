const { json }      = require('../utils/response')
const { parseBody } = require('../utils/parseBody')
const { createPart } = require('../services/orderService')
const { validateCreatePart } = require('../validators/partValidator')
const prisma = require('../repositories/prisma')

module.exports = [
  { method: 'POST', pathname: '/api/orders/:orderId/assemblies/:assemblyId/parts', handler: async (req, res, params) => {
    const body = await parseBody(req)
    const data = validateCreatePart(body)
    json(res, await createPart(params.assemblyId, data), 201)
  }},

  // Reorder parts within an assembly — accepts ordered array of part IDs
  { method: 'PATCH', pathname: '/api/orders/:orderId/assemblies/:assemblyId/parts/reorder', handler: async (req, res, params) => {
    const body = await parseBody(req)
    const ids = body.ids
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
      return json(res, { error: 'ids must be array of strings' }, 400)
    }
    await prisma.$transaction(
      ids.map((id, idx) =>
        prisma.part.update({ where: { id, assemblyId: params.assemblyId }, data: { position: idx } })
      )
    )
    json(res, { ok: true })
  }},
]
