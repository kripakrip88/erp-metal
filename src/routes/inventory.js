const { json }        = require('../utils/response')
const { getCompanyId } = require('../utils/company')
const {
  calculateInventoryAvailability,
  getInventoryAvailability,
  validateReservationAvailability,
} = require('../services/inventoryCompatibilityService')

module.exports = [
  // Rebuild availability balances for the company from active reservations
  { method: 'POST', pathname: '/api/inventory/rebuild', handler: async (req, res) => {
    const companyId = await getCompanyId()
    json(res, await calculateInventoryAvailability(companyId))
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
