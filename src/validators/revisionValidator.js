// ─── Assembly Revision validators ────────────────────────────────────────────

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

module.exports = { validateCreateDraft, validateFreeze, validateClone }
