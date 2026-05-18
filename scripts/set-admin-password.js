const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const email    = process.argv[2]
  const password = process.argv[3]
  if (!email || !password) {
    console.error('Usage: node scripts/set-admin-password.js <email> <password>')
    process.exit(1)
  }
  const hash = await bcrypt.hash(password, 12)
  const user = await prisma.user.update({ where: { email }, data: { passwordHash: hash } })
  console.log(`Password updated for ${user.email} (role: ${user.role})`)
}

main().catch(e => { console.error(e.message); process.exit(1) }).finally(() => prisma.$disconnect())