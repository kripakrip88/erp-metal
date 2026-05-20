const { json }        = require('../utils/response')
const { parseBody }   = require('../utils/parseBody')
const { requireRole } = require('../middleware/requireRole')
const { listOrders, getOrder, createOrder } = require('../services/orderService')
const { validateCreateOrder } = require('../validators/orderValidator')
const { transitionOrderStatus } = require('../services/orderLifecycleService')

const canCreate = requireRole('ADMIN', 'MANAGER', 'ENGINEER')
const canMove   = requireRole('ADMIN', 'MANAGER', 'ENGINEER')

module.exports = [
  { method: 'GET', pathname: '/api/orders', handler: async (req, res) => {
    json(res, await listOrders(req.context))
  }},
  { method: 'POST', pathname: '/api/orders', handler: async (req, res) => {
    if (!canCreate(req, res)) return
    const body = await parseBody(req)
    const data = validateCreateOrder(body)
    json(res, await createOrder(data, req.context), 201)
  }},
  { method: 'GET', pathname: '/api/orders/:id', handler: async (req, res, params) => {
    const data = await getOrder(params.id)
    if (!data) return json(res, { error: 'Not found' }, 404)
    json(res, data)
  }},
  { method: 'PATCH', pathname: '/api/orders/:id/status', handler: async (req, res, params) => {
    if (!canMove(req, res)) return
    const { status } = await parseBody(req)
    if (!status) return json(res, { error: 'status is required' }, 400)
    const result = await transitionOrderStatus(params.id, status)
    json(res, result)
  }},
]
