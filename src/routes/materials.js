const { json }       = require('../utils/response')
const { parseBody }  = require('../utils/parseBody')
const { listMaterials, getMaterial, createMaterial, updateMaterial, archiveMaterial, getFastenerFilterOptions } = require('../services/materialService')
const { validateMaterial } = require('../validators/materialValidator')

module.exports = [
  { method: 'GET', pathname: '/api/materials', handler: async (req, res, params, query) => {
    const q = new URLSearchParams(query || '')
    json(res, await listMaterials({
      search:         q.get('search')         || '',
      profileType:    q.get('profileType')    || '',
      categoryId:     q.get('categoryId')     || '',
      materialDomain: q.get('materialDomain') || '',
      fastener_type:  q.get('fastener_type')  || '',
      diameter_mm:    q.get('diameter_mm')    || '',
      length_mm:      q.get('length_mm')      || '',
      coating:        q.get('coating')        || '',
      strength_class: q.get('strength_class') || '',
      din:            q.get('din')            || '',
      thread_type:    q.get('thread_type')    || '',
      page:           q.get('page')           || '1',
      limit:          q.get('limit')          || '50',
      sortBy:         q.get('sortBy')         || '',
      sortDir:        q.get('sortDir')        || 'asc',
    }))
  }},
  { method: 'GET', pathname: '/api/materials/fastener-filters', handler: async (req, res, params, query) => {
    const q = new URLSearchParams(query || '')
    json(res, await getFastenerFilterOptions(q.get('fastener_type') || ''))
  }},
  { method: 'GET', pathname: '/api/materials/:id', handler: async (req, res, params) => {
    const data = await getMaterial(params.id)
    if (!data) return json(res, { error: 'Not found' }, 404)
    json(res, data)
  }},
  { method: 'POST', pathname: '/api/materials', handler: async (req, res) => {
    const body = await parseBody(req)
    json(res, await createMaterial(validateMaterial(body)), 201)
  }},
  { method: 'PUT', pathname: '/api/materials/:id', handler: async (req, res, params) => {
    const body = await parseBody(req)
    json(res, await updateMaterial(params.id, validateMaterial(body)))
  }},
  { method: 'DELETE', pathname: '/api/materials/:id', handler: async (req, res, params) => {
    json(res, await archiveMaterial(params.id))
  }},
]
