const { json }            = require('../utils/response')
const { listMaterials, getMaterial } = require('../services/materialService')

module.exports = [
  { method: 'GET', pathname: '/api/materials', handler: async (req, res, params, query) => {
    const q = new URLSearchParams(query || '')
    const data = await listMaterials({ search: q.get('search') || '', profileType: q.get('profileType') || '', categoryId: q.get('categoryId') || '' })
    json(res, data)
  }},
  { method: 'GET', pathname: '/api/materials/:id', handler: async (req, res, params) => {
    const data = await getMaterial(params.id)
    if (!data) return json(res, { error: 'Not found' }, 404)
    json(res, data)
  }},
]
