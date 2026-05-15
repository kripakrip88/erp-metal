// ─── Assembly Revision validators ────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateUUID(value, field) {
  if (!value || !UUID_RE.test(value)) throw new Error(`${field} должен быть валидным UUID`)
  return value
}

// Returns null if absent, validates format if present
function validateOptionalUUID(value, field) {
  if (value == null || value === '') return null
  return validateUUID(value, field)
}

function validateNotes(value) {
  if (!value) return null
  if (value.length > 2000) throw new Error('notes не должен превышать 2000 символов')
  return value
}

function validateFreezeReason(value) {
  if (!value) return null
  if (value.length > 1000) throw new Error('freezeReason не должен превышать 1000 символов')
  return value
}

function validateCreateDraft(body) {
  return {
    notes:           validateNotes(body.notes),
    createdByUserId: validateOptionalUUID(body.createdByUserId, 'createdByUserId'),
  }
}

function validateFreeze(body) {
  return {
    frozenByUserId: validateOptionalUUID(body.frozenByUserId, 'frozenByUserId'),
    freezeReason:   validateFreezeReason(body.freezeReason),
  }
}

function validateClone(body) {
  return {
    notes:           validateNotes(body.notes),
    createdByUserId: validateOptionalUUID(body.createdByUserId, 'createdByUserId'),
  }
}

module.exports = { validateUUID, validateCreateDraft, validateFreeze, validateClone }
