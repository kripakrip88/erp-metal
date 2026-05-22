const bcrypt          = require('bcryptjs')
const { json }        = require('../utils/response')
const { parseBody }   = require('../utils/parseBody')
const { requireRole } = require('../middleware/requireRole')
const prisma          = require('../repositories/prisma')

const adminOnly = requireRole('ADMIN')

const USER_SELECT = {
  id: true, email: true, firstName: true, lastName: true,
  role: true, isActive: true, lastLoginAt: true, createdAt: true,
}

module.exports = [
  // List all users in the company
  { method: 'GET', pathname: '/api/users', handler: async (req, res) => {
    if (!adminOnly(req, res)) return
    const users = await prisma.user.findMany({
      where:   { companyId: req.user.companyId, deletedAt: null },
      select:  USER_SELECT,
      orderBy: { createdAt: 'asc' },
    })
    json(res, users)
  }},

  // Create a new user
  { method: 'POST', pathname: '/api/users', handler: async (req, res) => {
    if (!adminOnly(req, res)) return
    const { email, firstName, lastName, role, password } = await parseBody(req)
    if (!email || !password) return json(res, { error: 'email and password are required' }, 400)
    if (password.length < 8) return json(res, { error: 'Password must be at least 8 characters' }, 400)
    const allowed = ['ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER']
    if (role && !allowed.includes(role)) return json(res, { error: 'Invalid role' }, 400)

    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        firstName: firstName || '',
        lastName:  lastName  || '',
        role:      role      || 'VIEWER',
        companyId: req.user.companyId,
        passwordHash: hash,
        isActive: true,
      },
      select: USER_SELECT,
    })
    json(res, user, 201)
  }},

  // Update user (name, role, active status)
  { method: 'PUT', pathname: '/api/users/:id', handler: async (req, res, params) => {
    if (!adminOnly(req, res)) return
    const { firstName, lastName, role, isActive } = await parseBody(req)
    if (params.id === req.user.userId && isActive === false)
      return json(res, { error: 'Cannot deactivate yourself' }, 400)

    const data = {}
    if (firstName !== undefined) data.firstName = firstName
    if (lastName  !== undefined) data.lastName  = lastName
    if (isActive  !== undefined) data.isActive  = isActive
    if (role !== undefined) {
      const allowed = ['ADMIN', 'MANAGER', 'ENGINEER', 'VIEWER']
      if (!allowed.includes(role)) return json(res, { error: 'Invalid role' }, 400)
      data.role = role
    }
    const user = await prisma.user.update({ where: { id: params.id }, data, select: USER_SELECT })
    json(res, user)
  }},

  // Reset user password
  { method: 'POST', pathname: '/api/users/:id/reset-password', handler: async (req, res, params) => {
    if (!adminOnly(req, res)) return
    const { password } = await parseBody(req)
    if (!password || password.length < 8)
      return json(res, { error: 'Password must be at least 8 characters' }, 400)
    const hash = await bcrypt.hash(password, 10)
    await prisma.user.update({ where: { id: params.id }, data: { passwordHash: hash } })
    json(res, { ok: true })
  }},
]
