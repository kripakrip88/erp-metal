/**
 * AI Service proxy — manages JWT token for metalpro-ai-polygon
 * Token is stored in memory, refreshed 1 minute before expiry.
 */

const AI_URL      = process.env.AI_SERVICE_URL      || 'http://localhost:4000'
const AI_EMAIL    = process.env.AI_SERVICE_EMAIL    || ''
const AI_PASSWORD = process.env.AI_SERVICE_PASSWORD || ''

// Access token is 15m; we refresh after 14m to stay ahead
const TOKEN_TTL_MS = 14 * 60 * 1000

let _token    = null
let _expireAt = 0

async function login() {
  const res = await fetch(`${AI_URL}/api/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email: AI_EMAIL, password: AI_PASSWORD }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AI service login failed (${res.status}): ${text}`)
  }

  const data  = await res.json()
  _token      = data.accessToken
  _expireAt   = Date.now() + TOKEN_TTL_MS
  return _token
}

async function getToken() {
  if (_token && Date.now() < _expireAt) return _token
  return login()
}

/**
 * Proxy a request to the AI service.
 * @param {string} method  HTTP method
 * @param {string} path    Path on AI service (e.g. /api/email-copilot/inbox)
 * @param {object|null} body  JSON body or null
 */
async function proxyToAi(method, path, body = null) {
  const token = await getToken()

  const options = {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }
  if (body !== null) options.body = JSON.stringify(body)

  const res = await fetch(`${AI_URL}${path}`, options)

  // If 401 — token might be stale; retry once after fresh login
  if (res.status === 401) {
    _token = null
    const freshToken = await login()
    options.headers['Authorization'] = `Bearer ${freshToken}`
    return fetch(`${AI_URL}${path}`, options)
  }

  return res
}

module.exports = { proxyToAi }
