const { json }      = require('../utils/response')
const { parseBody } = require('../utils/parseBody')
const { getRevisions, createRevision } = require('../services/revisionService')

module.exports = [
  { method: 'GET', pathname: '/api/orders/:orderId/revisions', handler: async (req, res, params) => {
    json(res, await getRevisions(params.orderId))
  }},
  { method: 'POST', pathname: '/api/orders/:orderId/revisions', handler: async (req, res, params) => {
    const body = await parseBody(req)
    json(res, await createRevision(params.orderId, body.notes), 201)
  }},
]
