const { z }        = require('zod')
const { parseZod } = require('../utils/zodParse')

// Accepts non-empty string UUID; returns null for empty / absent values
const optionalUUID = z.preprocess(
  v => (v == null || v === '') ? null : v,
  z.string().uuid('должен быть валидным UUID').nullable(),
)

const CreateDraftSchema = z.object({
  notes:           z.string().max(2000, 'notes не должен превышать 2000 символов').optional().nullable().default(null),
  createdByUserId: optionalUUID.default(null),
})

const FreezeSchema = z.object({
  frozenByUserId: optionalUUID.default(null),
  freezeReason:   z.string().max(1000, 'freezeReason не должен превышать 1000 символов').optional().nullable().default(null),
})

const CloneSchema = z.object({
  notes:           z.string().max(2000, 'notes не должен превышать 2000 символов').optional().nullable().default(null),
  createdByUserId: optionalUUID.default(null),
})

// Re-exported for callers that validate a single UUID param directly
function validateUUID(value, field) {
  const result = z.string().uuid().safeParse(value)
  if (!result.success) {
    throw Object.assign(new Error(`${field} должен быть валидным UUID`), { status: 400 })
  }
  return result.data
}

function validateCreateDraft(body) { return parseZod(CreateDraftSchema, body) }
function validateFreeze(body)       { return parseZod(FreezeSchema, body) }
function validateClone(body)        { return parseZod(CloneSchema, body) }

module.exports = { validateUUID, validateCreateDraft, validateFreeze, validateClone }
