const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Temp password: MetallPro2026!
const TEMP_HASH = '$2b$12$/uJQ4MwXjp/wsBPJaui7O.czaXJwGrirtrmM1CEnIPDPmhHTxIolq'

async function main() {
  const user = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  })

  if (!user) {
    console.log('No admin user found — skipping emergency reset')
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    data:  { passwordHash: TEMP_HASH, isActive: true, deletedAt: null },
  })

  console.log(`Emergency reset done. Login: ${user.email} / MetallPro2026!`)
  console.log('IMPORTANT: change password after login!')
}

main()
  .catch(e => { console.error('Emergency reset failed:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
