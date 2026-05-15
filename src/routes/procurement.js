const { json }   = require('../utils/response')
const prisma     = require('../repositories/prisma')
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

module.exports = [
  { method: 'GET', pathname: '/api/orders/:orderId/procurement-snapshot', handler: async (req, res, params) => {
    json(res, await getReleasedProcurementSnapshot(params.orderId))
  }},
  { method: 'GET', pathname: '/api/assemblies/:assemblyId/procurement-snapshot', handler: async (req, res, params) => {
    json(res, await getAssemblyProcurementSnapshot(params.assemblyId))
  }},

  // Material reservations
  { method: 'POST', pathname: '/api/orders/:orderId/reservations', handler: async (req, res, params) => {
    json(res, await createReservationsFromReleasedRevision(params.orderId), 201)
  }},
  { method: 'GET', pathname: '/api/orders/:orderId/reservations', handler: async (req, res, params) => {
    json(res, await getOrderReservations(params.orderId))
  }},
  { method: 'GET', pathname: '/api/reservations/totals', handler: async (req, res) => {
    const company = await prisma.company.findFirst({ select: { id: true } })
    if (!company) return json(res, { error: 'Company not found' }, 404)
    json(res, await getReservedMaterialTotals(company.id))
  }},
  { method: 'DELETE', pathname: '/api/reservations/:reservationId', handler: async (req, res, params) => {
    json(res, await cancelReservation(params.reservationId))
  }},
]
