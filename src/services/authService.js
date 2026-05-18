const bcrypt = require('bcryptjs')
const prisma  = require('../repositories/prisma')
const { signToken } = require('../utils/auth')

async function login(email, password) {
  if (!email || !password)
    throw Object.assign(new Error('email and password required'), { status: 400 })

  const user = await prisma.user.findFirst({
    where: {
      email:     { equals: email.trim(), mode: 'insensitive' },
      isActive:  true,
      deletedAt: null,
    },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, passwordHash: true, companyId: true,
    },
  })
  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { status: 401 })

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const token = signToken({ userId: user.id, role: user.role, companyId: user.companyId })
  const { passwordHash: _, ...userOut } = user
  return { token, user: userOut }
}

async function getMe(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, companyId: true, lastLoginAt: true,
    },
  })
}

module.exports = { login, getMe }