const { json }       = require('../utils/response')
const { parseBody }  = require('../utils/parseBody')
const { requireRole} = require('../middleware/requireRole')
const { createOrderFromEmail } = require('../services/createOrderFromEmailService')

const canCreate = requireRole('ADMIN', 'MANAGER', 'ENGINEER')

module.exports = [
  { method: 'POST', pathname: '/api/orders/from-email', handler: async (req, res) => {
    if (!canCreate(req, res)) return
    try {
      const body = await parseBody(req)
      const { messageId, title, fromAddress, fromName, subject, normalizationResults } = body

      if (!messageId)   return json(res, { error: 'messageId is required' }, 400)
      if (!fromAddress) return json(res, { error: 'fromAddress is required' }, 400)

      const result = await createOrderFromEmail({
        messageId,
        title,
        fromAddress,
        fromName,
        subject,
        normalizationResults: Array.isArray(normalizationResults) ? normalizationResults : [],
        actorId:   req.context?.userId    || null,
        companyId: req.context?.companyId || null,
      })

      json(res, result, result.created ? 201 : 200)
    } catch (err) {
      console.error('[from-email] error:', err.message)
      json(res, { error: err.message }, err.status || 500)
    }
  }},
]
