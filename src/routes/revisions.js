const { json }        = require('../utils/response')
const { parseBody }   = require('../utils/parseBody')
const { requireRole } = require('../middleware/requireRole')
const {
  getRevisions,
  createRevision,
  setActiveQuoteRevision,
  listUnreferencedFrozenRevisions,
} = require('../services/revisionService')

const canWrite = requireRole('ADMIN', 'MANAGER', 'ENGINEER')

module.exports = [
  { method: 'GET', pathname: '/api/orders/:orderId/revisions', handler: async (req, res, params) => {
    json(res, await getRevisions(params.orderId))
  }},
  { method: 'POST', pathname: '/api/orders/:orderId/revisions', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    json(res, await createRevision(params.orderId, body.notes), 201)
  }},
  { method: 'PATCH', pathname: '/api/orders/:orderId/revisions/:revisionId/activate', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    json(res, await setActiveQuoteRevision(params.orderId, params.revisionId))
  }},
  { method: 'GET', pathname: '/api/orders/:orderId/revisions/unreferenced-frozen', handler: async (req, res, params) => {
    json(res, await listUnreferencedFrozenRevisions(params.orderId))
  }},
]
