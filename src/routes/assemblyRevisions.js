const { json }      = require('../utils/response')
const { parseBody } = require('../utils/parseBody')
const { validateUUID, validateCreateDraft, validateFreeze, validateClone } = require('../validators/revisionValidator')
const {
  createDraftRevision,
  freezeAssemblyRevision,
  createAssemblyRevisionFromRevision,
  listAssemblyRevisions,
  getAssemblyRevision,
  compareRevisions,
} = require('../services/assemblyRevisionService')

module.exports = [
  // ─── Assembly-scoped ───────────────────────────────────────────────────────

  { method: 'GET', pathname: '/api/assemblies/:assemblyId/assembly-revisions', handler: async (req, res, params) => {
    validateUUID(params.assemblyId, 'assemblyId')
    json(res, await listAssemblyRevisions(params.assemblyId))
  }},

  { method: 'POST', pathname: '/api/assemblies/:assemblyId/assembly-revisions', handler: async (req, res, params) => {
    validateUUID(params.assemblyId, 'assemblyId')
    const body = await parseBody(req)
    const opts = validateCreateDraft(body)
    json(res, await createDraftRevision(params.assemblyId, opts), 201)
  }},

  // ─── Revision-scoped — compare must precede /:revisionId ──────────────────

  { method: 'GET', pathname: '/api/assembly-revisions/compare', handler: async (req, res, params, query) => {
    const qs = new URLSearchParams(query || '')
    const a  = qs.get('a')
    const b  = qs.get('b')
    if (!a || !b) return json(res, { error: 'Query params a and b are required' }, 400)
    validateUUID(a, 'a')
    validateUUID(b, 'b')
    json(res, await compareRevisions(a, b))
  }},

  { method: 'GET', pathname: '/api/assembly-revisions/:revisionId', handler: async (req, res, params) => {
    validateUUID(params.revisionId, 'revisionId')
    json(res, await getAssemblyRevision(params.revisionId))
  }},

  { method: 'POST', pathname: '/api/assembly-revisions/:revisionId/freeze', handler: async (req, res, params) => {
    validateUUID(params.revisionId, 'revisionId')
    const body = await parseBody(req)
    const opts = validateFreeze(body)
    json(res, await freezeAssemblyRevision(params.revisionId, opts))
  }},

  { method: 'POST', pathname: '/api/assembly-revisions/:revisionId/clone', handler: async (req, res, params) => {
    validateUUID(params.revisionId, 'revisionId')
    const body = await parseBody(req)
    const opts = validateClone(body)
    json(res, await createAssemblyRevisionFromRevision(params.revisionId, opts), 201)
  }},
]
