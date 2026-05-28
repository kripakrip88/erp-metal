const http = require('http')
const { json }      = require('../utils/response')
const { parseBody } = require('../utils/parseBody')
const { createPart } = require('../services/orderService')
const { validateCreatePart } = require('../validators/partValidator')
const prisma = require('../repositories/prisma')

const AI_HOST = process.env.AI_POLYGON_HOST || 'localhost'
const AI_PORT = parseInt(process.env.AI_POLYGON_PORT || '4000', 10)

function callAiPolygon(path, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body)
    const req = http.request(
      { hostname: AI_HOST, port: AI_PORT, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      (res) => { const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve({ ok: res.statusCode < 400 })) }
    )
    req.on('error', () => resolve({ ok: false }))
    req.write(payload)
    req.end()
  })
}

module.exports = [
  { method: 'POST', pathname: '/api/orders/:orderId/assemblies/:assemblyId/parts', handler: async (req, res, params) => {
    const body = await parseBody(req)
    const data = validateCreatePart(body)
    json(res, await createPart(params.assemblyId, data), 201)
  }},

  // AI confirm/replace: update Part + proxy correction to AI Polygon
  { method: 'POST', pathname: '/api/parts/:partId/ai-confirm', handler: async (req, res, params) => {
    const body = await parseBody(req)
    const { action, materialDefinitionId, materialName, rememberAlias } = body

    if (!['confirmed', 'replaced', 'skipped'].includes(action))
      return json(res, { error: 'action must be confirmed | replaced | skipped' }, 400)

    const part = await prisma.part.findUnique({ where: { id: params.partId } })
    if (!part)            return json(res, { error: 'Part not found' }, 404)
    if (!part.aiGenerated) return json(res, { error: 'Not an AI-generated part' }, 400)

    // Update Part in ERP
    const updateData = { aiStatus: action === 'confirmed' ? 'confirmed' : action === 'replaced' ? 'replaced' : 'skipped' }
    if (action === 'replaced' && materialDefinitionId) {
      updateData.materialDefinitionId = materialDefinitionId
      updateData.name = materialName || part.name
    }
    const updated = await prisma.part.update({ where: { id: part.id }, data: updateData })

    // Proxy correction to AI Polygon (best-effort, don't block response)
    if (part.aiNormResultId) {
      callAiPolygon('/api/normalization/correct', {
        normalization_result_id: part.aiNormResultId,
        action,
        confirmed_material_id: materialDefinitionId || null,
        confirmed_by: req.context?.userId || null,
        remember_alias: rememberAlias === true,
      }).catch(() => {})
    }

    json(res, { ok: true, partId: part.id, materialName: updated.name })
  }},

  // Reorder parts within an assembly — accepts ordered array of part IDs
  { method: 'PATCH', pathname: '/api/orders/:orderId/assemblies/:assemblyId/parts/reorder', handler: async (req, res, params) => {
    const body = await parseBody(req)
    const ids = body.ids
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
      return json(res, { error: 'ids must be array of strings' }, 400)
    }
    await prisma.$transaction(
      ids.map((id, idx) =>
        prisma.part.update({ where: { id, assemblyId: params.assemblyId }, data: { position: idx } })
      )
    )
    json(res, { ok: true })
  }},
]
