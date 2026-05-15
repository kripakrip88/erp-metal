const { json }      = require('../utils/response')
const { parseBody } = require('../utils/parseBody')
const { validateCoatingMaterial } = require('../validators/coatingValidator')
const { listCoatingMaterials, createCoatingMaterial, updateCoatingMaterial } = require('../services/coatingService')

module.exports = [
  { method: 'GET', pathname: '/api/coating-materials', handler: async (req, res) => {
    json(res, await listCoatingMaterials())
  }},
  { method: 'POST', pathname: '/api/coating-materials', handler: async (req, res) => {
    const body = await parseBody(req)
    const data = validateCoatingMaterial(body)
    json(res, await createCoatingMaterial(data), 201)
  }},
  { method: 'PUT', pathname: '/api/coating-materials/:id', handler: async (req, res, params) => {
    const body = await parseBody(req)
    const data = validateCoatingMaterial(body)
    json(res, await updateCoatingMaterial(params.id, data))
  }},
]
