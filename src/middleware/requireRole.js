const { json } = require('../utils/response')

// Factory that returns a route guard allowing only the specified roles.
// Usage: if (!requireRole('ADMIN', 'MANAGER')(req, res)) return
function requireRole(...roles) {
  return function guard(req, res) {
    if (!req.user) {
      json(res, { error: 'Unauthorized' }, 401)
      return false
    }
    if (!roles.includes(req.user.role)) {
      json(res, { error: 'Forbidden' }, 403)
      return false
    }
    return true
  }
}

module.exports = { requireRole }
