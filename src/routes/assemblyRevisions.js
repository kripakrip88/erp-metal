const { json }         = require('../utils/response')
const { parseBody }    = require('../utils/parseBody')
const { requireRole }  = require('../middleware/requireRole')
const { validateUUID, validateCreateDraft, validateFreeze, validateClone } = require('../validators/revisionValidator')
const {
  createDraftRevision,
  freezeAssemblyRevision,
  createAssemblyRevisionFromRevision,
  restoreAssemblyFromRevision,
  listAssemblyRevisions,
  getAssemblyRevision,
  compareRevisions,
} = require('../services/assemblyRevisionService')

const canWrite   = requireRole('ADMIN', 'ENGINEER')
const canManage  = requireRole('ADMIN', 'ENGINEER', 'MANAGER')

function handleRevisionError(res, err) {
  json(res, { error: err.message }, 400)
}

module.exports = [
  // ─── Assembly-scoped ───────────────────────────────────────────────────────

  { method: 'GET', pathname: '/api/assemblies/:assemblyId/assembly-revisions', handler: async (req, res, params) => {
    try {
      validateUUID(params.assemblyId, 'assemblyId')
      json(res, await listAssemblyRevisions(params.assemblyId))
    } catch (err) { handleRevisionError(res, err) }
  }},

  { method: 'POST', pathname: '/api/assemblies/:assemblyId/assembly-revisions', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    try {
      validateUUID(params.assemblyId, 'assemblyId')
      const body = await parseBody(req)
      const opts = validateCreateDraft(body)
      json(res, await createDraftRevision(params.assemblyId, opts), 201)
    } catch (err) { handleRevisionError(res, err) }
  }},

  // ─── Revision-scoped — compare must precede /:revisionId ──────────────────

  { method: 'GET', pathname: '/api/assembly-revisions/compare', handler: async (req, res, params, query) => {
    try {
      const qs = new URLSearchParams(query || '')
      const a  = qs.get('a')
      const b  = qs.get('b')
      if (!a || !b) return json(res, { error: 'Query params a and b are required' }, 400)
      validateUUID(a, 'a')
      validateUUID(b, 'b')
      json(res, await compareRevisions(a, b))
    } catch (err) { handleRevisionError(res, err) }
  }},

  { method: 'GET', pathname: '/api/assembly-revisions/:revisionId', handler: async (req, res, params) => {
    try {
      validateUUID(params.revisionId, 'revisionId')
      json(res, await getAssemblyRevision(params.revisionId))
    } catch (err) { handleRevisionError(res, err) }
  }},

  { method: 'POST', pathname: '/api/assembly-revisions/:revisionId/freeze', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    try {
      validateUUID(params.revisionId, 'revisionId')
      const body = await parseBody(req)
      const opts = validateFreeze(body)
      json(res, await freezeAssemblyRevision(params.revisionId, opts))
    } catch (err) { handleRevisionError(res, err) }
  }},

  { method: 'POST', pathname: '/api/assembly-revisions/:revisionId/clone', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    try {
      validateUUID(params.revisionId, 'revisionId')
      const body = await parseBody(req)
      const opts = validateClone(body)
      json(res, await createAssemblyRevisionFromRevision(params.revisionId, opts), 201)
    } catch (err) { handleRevisionError(res, err) }
  }},

  { method: 'POST', pathname: '/api/assembly-revisions/:revisionId/restore', handler: async (req, res, params) => {
    if (!canWrite(req, res)) return
    try {
      validateUUID(params.revisionId, 'revisionId')
      json(res, await restoreAssemblyFromRevision(params.revisionId))
    } catch (err) { handleRevisionError(res, err) }
  }},
]
