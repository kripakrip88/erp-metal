const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const email    = process.argv[2]
  const password = process.argv[3]
  if (!email || !password) {
    console.error('Usage: node scripts/create-or-reset-admin.js <email> <password>')
    console.error('Example: node scripts/create-or-reset-admin.js admin@company.ru MyPassword123')
    process.exit(1)
  }

  const hash = await bcrypt.hash(password, 12)

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
  })

  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data:  { passwordHash: hash, isActive: true, deletedAt: null },
    })
    console.log(`✓ Password reset for ${user.email} (role: ${user.role}, isActive: ${user.isActive})`)
    return
  }

  // User doesn't exist — find or create company first
  let company = await prisma.company.findFirst()
  if (!company) {
    company = await prisma.company.create({
      data: { name: 'МеталлПро', slug: 'metallpro' },
    })
    console.log(`✓ Created company: ${company.name} (id: ${company.id})`)
  } else {
    console.log(`✓ Using company: ${company.name} (id: ${company.id})`)
  }

  const user = await prisma.user.create({
    data: {
      companyId:    company.id,
      email:        email.trim(),
      passwordHash: hash,
      firstName:    'Admin',
      lastName:     'User',
      role:         'ADMIN',
      isActive:     true,
    },
  })
  console.log(`✓ Created admin user: ${user.email} (role: ${user.role})`)
}

main()
  .catch(e => { console.error('Error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
