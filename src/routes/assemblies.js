const { json }        = require('../utils/response')
const { parseBody }   = require('../utils/parseBody')
const { requireRole } = require('../middleware/requireRole')
const { createAssembly, clearAssemblies } = require('../services/orderService')
const { applyTemplateToAssembly }         = require('../services/templateService')

const canWrite  = requireRole('ENGINEER', 'MANAGER', 'ADMIN')
const canManage = requireRole('MANAGER', 'ADMIN')

module.exports = [
  { method: 'POST', pathname: '/api/orders/:orderId/assemblies', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    json(res, await createAssembly(params.orderId, body), 201)
  }},
  { method: 'DELETE', pathname: '/api/orders/:orderId/assemblies', handler: async (req, res, params) => {
    if (!canManage(req, res)) return
    json(res, await clearAssemblies(params.orderId))
  }},
  { method: 'POST', pathname: '/api/orders/:orderId/assemblies/:assemblyId/apply-template', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    if (!body.templateId) return json(res, { error: 'templateId обязательное поле' }, 400)
    json(res, await applyTemplateToAssembly(params.orderId, params.assemblyId, body.templateId, body.multiplier))
  }},
]
