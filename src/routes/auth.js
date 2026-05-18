const { parseBody } = require('../utils/parseBody')
const { json }      = require('../utils/response')
const { login, getMe } = require('../services/authService')

module.exports = [
  {
    method:   'POST',
    pathname: '/api/auth/login',
    handler:  async (req, res) => {
      const body   = await parseBody(req)
      const result = await login(body.email, body.password)
      json(res, result)
    },
  },
  {
    method:   'GET',
    pathname: '/api/auth/me',
    handler:  async (req, res) => {
      const user = await getMe(req.user.userId)
      if (!user) return json(res, { error: 'User not found' }, 404)
      json(res, user)
    },
  },
]