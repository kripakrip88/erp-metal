const { json }        = require('../utils/response')
const { parseBody }   = require('../utils/parseBody')
const { requireRole } = require('../middleware/requireRole')
const { listOrders, getOrder, createOrder } = require('../services/orderService')
const { validateCreateOrder } = require('../validators/orderValidator')
const { transitionOrderStatus } = require('../services/orderLifecycleService')
const orderRepo = require('../repositories/orderRepo')
const prisma    = require('../repositories/prisma')

const canWrite  = requireRole('ADMIN', 'MANAGER', 'ENGINEER')
const canDelete = requireRole('ADMIN', 'MANAGER')

const STATUS_LABELS = { DRAFT:'Новый запрос', QUOTATION:'На рассмотрении', AWAITING_APPROVAL:'Расчёт цены', APPROVED:'КП отправлено', PRODUCTION:'В производстве', COMPLETED:'Готово', DELIVERED:'Сдан', CANCELLED:'Отменён' }

module.exports = [
  { method: 'GET', pathname: '/api/orders', handler: async (req, res) => {
    json(res, await listOrders(req.context))
  }},
  { method: 'POST', pathname: '/api/orders', handler: async (req, res) => {
    if (!canWrite(req, res)) return
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
    if (!canWrite(req, res)) return
    const { status } = await parseBody(req)
    if (!status) return json(res, { error: 'status is required' }, 400)
    const result = await transitionOrderStatus(params.id, status)
    json(res, result)
  }},
  { method: 'PATCH', pathname: '/api/orders/:id', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    const allowed = {}
    if (body.customerName !== undefined) allowed.customerName = body.customerName || ''
    if (body.customerId   !== undefined) allowed.customerId   = body.customerId   || null
    if (body.title        !== undefined) allowed.title        = body.title        || ''
    if (body.description  !== undefined) allowed.description  = body.description  || null
    if (body.orderNumber  !== undefined && body.orderNumber)  allowed.orderNumber = body.orderNumber
    // If customerId given but no customerName, resolve from DB
    if (allowed.customerId && !allowed.customerName) {
      const c = await prisma.customer.findUnique({ where: { id: allowed.customerId }, select: { name: true } })
      if (c) allowed.customerName = c.name
    }
    const result = await orderRepo.update(params.id, allowed)
    json(res, result)
  }},
  { method: 'DELETE', pathname: '/api/orders/:id', handler: async (req, res, params) => {
    if (!canDelete(req, res)) return
    await orderRepo.softDelete(params.id)
    json(res, { ok: true })
  }},
]
