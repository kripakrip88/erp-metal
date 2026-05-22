const { json }        = require('../utils/response')
const { parseBody }   = require('../utils/parseBody')
const { requireRole } = require('../middleware/requireRole')
const {
  listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
  createNode, updateNode, deleteNode,
  createNodePart, updateNodePart, deleteNodePart,
} = require('../services/templateService')

const canWrite  = requireRole('ENGINEER', 'MANAGER', 'ADMIN')
const canManage = requireRole('MANAGER', 'ADMIN')

module.exports = [
  // ── Templates ──────────────────────────────────────────────────────────────
  { method: 'GET', pathname: '/api/templates', handler: async (req, res) => {
    json(res, await listTemplates())
  }},

  { method: 'POST', pathname: '/api/templates', handler: async (req, res) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    json(res, await createTemplate(body), 201)
  }},

  { method: 'GET', pathname: '/api/templates/:id', handler: async (req, res, params) => {
    const data = await getTemplate(params.id)
    if (!data) return json(res, { error: 'Not found' }, 404)
    json(res, data)
  }},

  { method: 'PUT', pathname: '/api/templates/:id', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    json(res, await updateTemplate(params.id, body))
  }},

  { method: 'DELETE', pathname: '/api/templates/:id', handler: async (req, res, params) => {
    if (!canManage(req, res)) return
    json(res, await deleteTemplate(params.id))
  }},

  // ── Nodes ──────────────────────────────────────────────────────────────────
  { method: 'POST', pathname: '/api/templates/:templateId/nodes', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    json(res, await createNode(params.templateId, body), 201)
  }},

  { method: 'PUT', pathname: '/api/templates/:templateId/nodes/:nodeId', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    json(res, await updateNode(params.nodeId, body))
  }},

  { method: 'DELETE', pathname: '/api/templates/:templateId/nodes/:nodeId', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    json(res, await deleteNode(params.nodeId))
  }},

  // ── Node Parts ─────────────────────────────────────────────────────────────
  { method: 'POST', pathname: '/api/templates/:templateId/nodes/:nodeId/parts', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    json(res, await createNodePart(params.nodeId, body), 201)
  }},

  { method: 'PUT', pathname: '/api/templates/:templateId/nodes/:nodeId/parts/:partId', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    const body = await parseBody(req)
    json(res, await updateNodePart(params.partId, body))
  }},

  { method: 'DELETE', pathname: '/api/templates/:templateId/nodes/:nodeId/parts/:partId', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    json(res, await deleteNodePart(params.partId))
  }},
]
