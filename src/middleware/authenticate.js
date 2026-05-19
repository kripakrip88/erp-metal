const { verifyToken }  = require('../utils/auth')
const { json }         = require('../utils/response')
const { buildContext } = require('../utils/context')

function authenticate(req, res) {
  const header = req.headers['authorization']
  if (!header || !header.startsWith('Bearer ')) {
    json(res, { error: 'Unauthorized' }, 401)
    return false
  }
  try {
    req.user    = verifyToken(header.slice(7))
    req.context = buildContext(req.user)
    return true
  } catch {
    json(res, { error: 'Invalid or expired token' }, 401)
    return false
  }
}

module.exports = { authenticate }