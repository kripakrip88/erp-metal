const { json }      = require('../utils/response')
const { parseBody } = require('../utils/parseBody')
const { createAssembly, clearAssemblies } = require('../services/orderService')
const { applyTemplateToAssembly }         = require('../services/templateService')
const prisma = require('../repositories/prisma')

module.exports = [
  { method: 'POST', pathname: '/api/orders/:orderId/assemblies', handler: async (req, res, params) => {
    const body = await parseBody(req)
    json(res, await createAssembly(params.orderId, body), 201)
  }},

  { method: 'PATCH', pathname: '/api/orders/:orderId/assemblies/:assemblyId', handler: async (req, res, params) => {
    const body = await parseBody(req)
    const data = {}
    if (body.name != null) data.name = String(body.name).trim() || undefined
    if (body.qty  != null) data.qty  = Math.max(1, parseInt(body.qty) || 1)
    if (!Object.keys(data).length) return json(res, { error: 'nothing to update' }, 400)
    const asm = await prisma.assembly.update({ where: { id: params.assemblyId, orderId: params.orderId }, data })
    json(res, { ok: true, id: asm.id, name: asm.name, qty: asm.qty })
  }},
  { method: 'DELETE', pathname: '/api/orders/:orderId/assemblies', handler: async (req, res, params) => {
    json(res, await clearAssemblies(params.orderId))
  }},
  { method: 'POST', pathname: '/api/orders/:orderId/assemblies/:assemblyId/apply-template', handler: async (req, res, params) => {
    const body = await parseBody(req)
    if (!body.templateId) return json(res, { error: 'templateId обязательное поле' }, 400)
    json(res, await applyTemplateToAssembly(params.orderId, params.assemblyId, body.templateId, body.multiplier))
  }},
]
