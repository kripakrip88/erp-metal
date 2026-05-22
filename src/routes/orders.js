const { json }        = require('../utils/response')
const { parseBody }   = require('../utils/parseBody')
const { requireRole } = require('../middleware/requireRole')
const { listOrders, getOrder, createOrder } = require('../services/orderService')
const { validateCreateOrder } = require('../validators/orderValidator')

const canManage = requireRole('MANAGER', 'ADMIN')

module.exports = [
  { method: 'GET', pathname: '/api/orders', handler: async (req, res) => {
    json(res, await listOrders())
  }},
  { method: 'POST', pathname: '/api/orders', handler: async (req, res) => {
    if (!canManage(req, res)) return
    const body = await parseBody(req)
    const data = validateCreateOrder(body)
    json(res, await createOrder(data), 201)
  }},
  { method: 'GET', pathname: '/api/orders/:id', handler: async (req, res, params) => {
    const data = await getOrder(params.id)
    if (!data) return json(res, { error: 'Not found' }, 404)
    json(res, data)
  }},
]
