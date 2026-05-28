const { json }        = require('../utils/response')
const { requireRole } = require('../middleware/requireRole')
const prisma          = require('../repositories/prisma')
const {
  calculateInventoryAvailability,
  getInventoryAvailability,
  validateReservationAvailability,
} = require('../services/inventoryCompatibilityService')

const adminOnly = requireRole('ADMIN')

module.exports = [
  // Rebuild availability balances for the company from active reservations
  { method: 'POST', pathname: '/api/inventory/rebuild', handler: async (req, res) => {
    if (!adminOnly(req, res)) return
    const company = await prisma.company.findFirst({ select: { id: true } })
    if (!company) return json(res, { error: 'Company not found' }, 404)
    json(res, await calculateInventoryAvailability(company.id))
  }},

  // Get current balance for a single coating material
  { method: 'GET', pathname: '/api/inventory/:materialId/availability', handler: async (req, res, params) => {
    json(res, await getInventoryAvailability(params.materialId))
  }},

  // Validate whether an order's reservations can be fulfilled
  { method: 'GET', pathname: '/api/orders/:orderId/inventory-validation', handler: async (req, res, params) => {
    json(res, await validateReservationAvailability(params.orderId))
  }},
]
