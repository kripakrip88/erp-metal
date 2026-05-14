// ─── Assembly Revision validators ────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateUUID(value, field) {
  if (!value || !UUID_RE.test(value)) throw new Error(`${field} должен быть валидным UUID`)
  return value
}

function validateCreateDraft(body) {
  return {
    notes:           body.notes           || null,
    createdByUserId: body.createdByUserId || null,
  }
}

function validateFreeze(body) {
  return {
    frozenByUserId: body.frozenByUserId || null,
    freezeReason:   body.freezeReason   || null,
  }
}

function validateClone(body) {
  return {
    notes:           body.notes           || null,
    createdByUserId: body.createdByUserId || null,
  }
}

module.exports = { validateUUID, validateCreateDraft, validateFreeze, validateClone }
