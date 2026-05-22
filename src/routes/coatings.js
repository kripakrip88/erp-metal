const { json }        = require('../utils/response')
const { parseBody }   = require('../utils/parseBody')
const { requireRole } = require('../middleware/requireRole')
const { validateAssemblyCoating } = require('../validators/coatingValidator')
const {
  listAssemblyCoatings, createAssemblyCoating,
  updateAssemblyCoating, deleteAssemblyCoating,
  recalculateAssemblyCoating,
  recalculateAssemblyCoatings,
  applyCoatingSystem,
} = require('../services/coatingService')

const canWrite = requireRole('ENGINEER', 'MANAGER', 'ADMIN')

module.exports = [
  { method: 'GET', pathname: '/api/assemblies/:assemblyId/coatings', handler: async (req, res, params) => {
    json(res, await listAssemblyCoatings(params.assemblyId))
  }},
  { method: 'POST', pathname: '/api/assemblies/:assemblyId/coatings', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    const data = validateAssemblyCoating(body)
    json(res, await createAssemblyCoating(params.assemblyId, data), 201)
  }},
  { method: 'PUT', pathname: '/api/assemblies/:assemblyId/coatings/:coatingId', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    const data = validateAssemblyCoating(body)
    json(res, await updateAssemblyCoating(params.coatingId, data))
  }},
  { method: 'DELETE', pathname: '/api/assemblies/:assemblyId/coatings/:coatingId', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    await deleteAssemblyCoating(params.coatingId)
    json(res, { ok: true })
  }},
  { method: 'POST', pathname: '/api/assemblies/:assemblyId/coatings/recalculate', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    json(res, await recalculateAssemblyCoatings(params.assemblyId))
  }},
  { method: 'POST', pathname: '/api/assemblies/:assemblyId/coatings/:coatingId/recalculate', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    json(res, await recalculateAssemblyCoating(params.coatingId))
  }},
  { method: 'POST', pathname: '/api/assemblies/:assemblyId/apply-coating-system', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    if (!body.coatingSystemId) return json(res, { error: 'coatingSystemId обязательное поле' }, 400)
    json(res, await applyCoatingSystem(
      params.assemblyId,
      body.coatingSystemId,
      { replaceExisting: body.replaceExisting === true }
    ), 201)
  }},
]
