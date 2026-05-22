const { verifyToken } = require('../utils/auth')
const { json }        = require('../utils/response')

function authenticate(req, res) {
  const header = req.headers['authorization']
  if (!header || !header.startsWith('Bearer ')) {
    json(res, { error: 'Unauthorized' }, 401)
    return false
  }
  try {
    const payload = verifyToken(header.slice(7))
    req.user    = payload
    req.context = { userId: payload.userId, companyId: payload.companyId, role: payload.role }
    return true
  } catch {
    json(res, { error: 'Invalid or expired token' }, 401)
    return false
  }
}

module.exports = { authenticate }