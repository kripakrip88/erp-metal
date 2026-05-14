const { json }      = require('../utils/response')
const { parseBody } = require('../utils/parseBody')
const { validateAssemblyCoating } = require('../validators/coatingValidator')
const {
  listAssemblyCoatings, createAssemblyCoating,
  updateAssemblyCoating, deleteAssemblyCoating,
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
]
