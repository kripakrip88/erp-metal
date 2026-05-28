const { json }      = require('../utils/response')
const { parseBody } = require('../utils/parseBody')
const { validateAssemblyCoating } = require('../validators/coatingValidator')
const prisma = require('../repositories/prisma')
const {
  listAssemblyCoatings, createAssemblyCoating,
  updateAssemblyCoating, deleteAssemblyCoating,
  recalculateAssemblyCoating,
  recalculateAssemblyCoatings,
  applyCoatingSystem,
} = require('../services/coatingService')

module.exports = [
  { method: 'GET', pathname: '/api/assemblies/:assemblyId/coatings', handler: async (req, res, params) => {
    json(res, await listAssemblyCoatings(params.assemblyId))
  }},
  { method: 'POST', pathname: '/api/assemblies/:assemblyId/coatings', handler: async (req, res, params) => {
    const body = await parseBody(req)
    const data = validateAssemblyCoating(body)
    json(res, await createAssemblyCoating(params.assemblyId, data), 201)
  }},
  { method: 'PUT', pathname: '/api/assemblies/:assemblyId/coatings/:coatingId', handler: async (req, res, params) => {
    const body = await parseBody(req)
    const data = validateAssemblyCoating(body)
    json(res, await updateAssemblyCoating(params.coatingId, data))
  }},
  { method: 'DELETE', pathname: '/api/assemblies/:assemblyId/coatings/:coatingId', handler: async (req, res, params) => {
    await deleteAssemblyCoating(params.coatingId)
    json(res, { ok: true })
  }},
  { method: 'POST', pathname: '/api/assemblies/:assemblyId/coatings/recalculate', handler: async (req, res, params) => {
    json(res, await recalculateAssemblyCoatings(params.assemblyId))
  }},
  { method: 'POST', pathname: '/api/assemblies/:assemblyId/coatings/:coatingId/recalculate', handler: async (req, res, params) => {
    json(res, await recalculateAssemblyCoating(params.coatingId))
  }},
  // Reorder coating layers — accepts ordered array of coating IDs
  { method: 'PATCH', pathname: '/api/assemblies/:assemblyId/coatings/reorder', handler: async (req, res, params) => {
    const body = await parseBody(req)
    const ids = body.ids
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
      return json(res, { error: 'ids must be array of strings' }, 400)
    }
    await prisma.$transaction(
      ids.map((id, idx) =>
        prisma.assemblyCoating.update({ where: { id, assemblyId: params.assemblyId }, data: { position: idx } })
      )
    )
    json(res, { ok: true })
  }},

  { method: 'POST', pathname: '/api/assemblies/:assemblyId/apply-coating-system', handler: async (req, res, params) => {
    const body = await parseBody(req)
    if (!body.coatingSystemId) return json(res, { error: 'coatingSystemId обязательное поле' }, 400)
    json(res, await applyCoatingSystem(
      params.assemblyId,
      body.coatingSystemId,
      { replaceExisting: body.replaceExisting === true }
    ), 201)
  }},
]
