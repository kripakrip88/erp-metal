const { json }       = require('../utils/response')
const { parseBody }  = require('../utils/parseBody')
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../services/categoryService')

module.exports = [
  {
    method: 'GET',
    pathname: '/api/material-categories',
    handler: async (req, res) => {
      const data = await listCategories()
      json(res, data)
    },
  },
  {
    method: 'POST',
    pathname: '/api/material-categories',
    handler: async (req, res) => {
      const body = await parseBody(req)
      if (!body.slug || !body.name) return json(res, { error: 'slug and name are required' }, 400)
      const data = await createCategory(body)
      json(res, data, 201)
    },
  },
  {
    method: 'PUT',
    pathname: '/api/material-categories/:id',
    handler: async (req, res, params) => {
      const body = await parseBody(req)
      const data = await updateCategory(params.id, body)
      json(res, data)
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
