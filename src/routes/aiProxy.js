/**
 * Proxy routes: ERP → AI service (metalpro-ai-polygon :4000)
 * These routes are PUBLIC on the ERP side (no ERP JWT required).
 * Authentication to the AI service is handled transparently via ai-proxy.js.
 */

const { json }      = require('../utils/response')
const { parseBody } = require('../utils/parseBody')
const { proxyToAi } = require('../utils/ai-proxy')

async function forwardJson(res, aiRes) {
  let data
  try {
    data = await aiRes.json()
  } catch {
    data = { error: 'AI service returned non-JSON response' }
  }
  json(res, data, aiRes.status)
}

module.exports = [
  // GET /proxy/ai/inbox
  {
    method: 'GET',
    pathname: '/proxy/ai/inbox',
    handler: async (req, res) => {
      const [, query] = req.url.split('?')
      const path = query ? `/api/email-copilot/inbox?${query}` : '/api/email-copilot/inbox'
      const aiRes = await proxyToAi('GET', path)
      await forwardJson(res, aiRes)
    },
  },

  // POST /proxy/ai/poll
  {
    method: 'POST',
    pathname: '/proxy/ai/poll',
    handler: async (_req, res) => {
      const aiRes = await proxyToAi('POST', '/api/email-copilot/poll')
      await forwardJson(res, aiRes)
    },
  },

  // POST /proxy/ai/analyze/:id
  {
    method: 'POST',
    pathname: '/proxy/ai/analyze/:id',
    handler: async (_req, res, params) => {
      const aiRes = await proxyToAi('POST', `/api/email-copilot/analyze/${params.id}`)
      await forwardJson(res, aiRes)
    },
  },

  // POST /proxy/ai/reply
  {
    method: 'POST',
    pathname: '/proxy/ai/reply',
    handler: async (req, res) => {
      const body  = await parseBody(req)
      const aiRes = await proxyToAi('POST', '/api/email-copilot/reply', body)
      await forwardJson(res, aiRes)
    },
  },

  // POST /proxy/ai/archive/:id
  {
    method: 'POST',
    pathname: '/proxy/ai/archive/:id',
    handler: async (_req, res, params) => {
      const aiRes = await proxyToAi('POST', `/api/email-copilot/archive/${params.id}`)
      await forwardJson(res, aiRes)
    },
  },

  // POST /proxy/ai/create-rfq
  {
    method: 'POST',
    pathname: '/proxy/ai/create-rfq',
    handler: async (req, res) => {
      const body  = await parseBody(req)
      const aiRes = await proxyToAi('POST', '/api/email-copilot/create-rfq', body)
      await forwardJson(res, aiRes)
    },
  },
]
