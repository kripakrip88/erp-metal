const { json }       = require('../utils/response')
const { parseBody }  = require('../utils/parseBody')
const { listCategories, createCategory, updateCategory, deleteCategory } = require('../services/categoryService')

module.exports = [
  {
    method: 'GET',
    pathname: '/api/material-categories',
    handler: async (req, res) => {
      const q = new URL(req.url, 'http://x').searchParams
      const domain = q.get('domain') || undefined
      json(res, await listCategories({ domain }))
    },
  },
  {
    method: 'POST',
    pathname: '/api/material-categories',
    handler: async (req, res) => {
      const body = await parseBody(req)
      if (!body.slug || !body.name) return json(res, { error: 'slug and name are required' }, 400)
      json(res, await createCategory(body), 201)
    },
  },
  {
    method: 'PUT',
    pathname: '/api/material-categories/:id',
    handler: async (req, res, params) => {
      const body = await parseBody(req)
      json(res, await updateCategory(params.id, body))
    },
  },
  {
    method: 'DELETE',
    pathname: '/api/material-categories/:id',
    handler: async (req, res, params) => {
      await deleteCategory(params.id)
      json(res, { ok: true })
    },
  },
]
