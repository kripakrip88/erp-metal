const { z } = require('zod')

// Runs Zod safeParse and throws an Error with status 400 on failure.
// Error message lists all field-level issues, e.g. "title: Required; mode: Invalid enum value"
function parseZod(schema, body) {
  const result = schema.safeParse(body)
  if (!result.success) {
    const messages = result.error.issues
      .map(e => e.path.length ? `${e.path.join('.')}: ${e.message}` : e.message)
      .join('; ')
    throw Object.assign(new Error(messages), { status: 400 })
  }
  return result.data
}

module.exports = { parseZod }
