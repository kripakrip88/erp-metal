const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Temp password: MetallPro2026!
const TEMP_HASH = '$2b$12$/uJQ4MwXjp/wsBPJaui7O.czaXJwGrirtrmM1CEnIPDPmhHTxIolq'

async function main() {
  // Убедиться что компания существует
  let company = await prisma.company.findFirst()
  if (!company) {
    company = await prisma.company.create({
      data: { name: 'МеталлПро', slug: 'metallpro' },
    })
    console.log(`Created company: ${company.name} (${company.id})`)
  }

  // Переназначить материалы с несуществующим companyId на текущую компанию
  const validIds = (await prisma.company.findMany({ select: { id: true } })).map(c => c.id)
  const orphaned = await prisma.materialDefinition.updateMany({
    where: { companyId: { notIn: validIds } },
    data:  { companyId: company.id },
  })
  if (orphaned.count > 0) {
    console.log(`Reassigned ${orphaned.count} orphaned materials to company ${company.id}`)
  }

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
