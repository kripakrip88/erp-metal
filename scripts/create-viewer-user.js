require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } })
  if (!company) { console.error('Company not found'); process.exit(1) }

  const passwordHash = await bcrypt.hash('Viewer2026!', 10)

  const user = await prisma.user.upsert({
    where: { email: 'viewer@test.local' },
    update: { passwordHash, isActive: true },
    create: {
      companyId:    company.id,
      email:        'viewer@test.local',
      firstName:    'Тест',
      lastName:     'Viewer',
      passwordHash,
      role:         'VIEWER',
      isActive:     true,
    },
  })

  console.log('✓ Пользователь создан')
  console.log('  Email:    viewer@test.local')
  console.log('  Пароль:   Viewer2026!')
  console.log('  Роль:     VIEWER')
  console.log('  ID:       ' + user.id)
}

main().catch(console.error).finally(() => prisma.$disconnect())
