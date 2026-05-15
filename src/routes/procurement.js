const { json } = require('../utils/response')
const {
  getReleasedProcurementSnapshot,
  getAssemblyProcurementSnapshot,
} = require('../services/procurementSnapshotService')

module.exports = [
  { method: 'GET', pathname: '/api/orders/:orderId/procurement-snapshot', handler: async (req, res, params) => {
    json(res, await getReleasedProcurementSnapshot(params.orderId))
  }},
  { method: 'GET', pathname: '/api/assemblies/:assemblyId/procurement-snapshot', handler: async (req, res, params) => {
    json(res, await getAssemblyProcurementSnapshot(params.assemblyId))
  }},
]
