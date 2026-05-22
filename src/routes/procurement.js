const { json }         = require('../utils/response')
const { getCompanyId } = require('../utils/company')
const { requireRole }  = require('../middleware/requireRole')
const {
  getReleasedProcurementSnapshot,
  getAssemblyProcurementSnapshot,
} = require('../services/procurementSnapshotService')
const {
  createReservationsFromReleasedRevision,
  getReservedMaterialTotals,
  getOrderReservations,
  cancelReservation,
} = require('../services/materialReservationService')

const canManage = requireRole('MANAGER', 'ADMIN')

module.exports = [
  { method: 'GET', pathname: '/api/orders/:orderId/procurement-snapshot', handler: async (req, res, params) => {
    json(res, await getReleasedProcurementSnapshot(params.orderId))
  }},
  { method: 'GET', pathname: '/api/assemblies/:assemblyId/procurement-snapshot', handler: async (req, res, params) => {
    json(res, await getAssemblyProcurementSnapshot(params.assemblyId))
  }},

  // Material reservations
  { method: 'POST', pathname: '/api/orders/:orderId/reservations', handler: async (req, res, params) => {
    if (!canManage(req, res)) return
    json(res, await createReservationsFromReleasedRevision(params.orderId), 201)
  }},
  { method: 'GET', pathname: '/api/orders/:orderId/reservations', handler: async (req, res, params) => {
    json(res, await getOrderReservations(params.orderId))
  }},
  { method: 'GET', pathname: '/api/reservations/totals', handler: async (req, res) => {
    const companyId = await getCompanyId()
    json(res, await getReservedMaterialTotals(companyId))
  }},
  { method: 'DELETE', pathname: '/api/reservations/:reservationId', handler: async (req, res, params) => {
    if (!canManage(req, res)) return
    json(res, await cancelReservation(params.reservationId))
  }},
]
