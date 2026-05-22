const { json } = require('../utils/response')

/**
 * Returns a guard function that checks req.user.role.
 * Usage: const canWrite = requireRole('ENGINEER', 'MANAGER', 'ADMIN')
 *        if (!canWrite(req, res)) return
 */
function requireRole(...roles) {
  return function guard(req, res) {
    if (!roles.includes(req.user?.role)) {
      json(res, { error: 'Forbidden' }, 403)
      return false
    }
    return true
  }
}

module.exports = { requireRole }
