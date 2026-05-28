/**
 * Seed script: добавляет тестовые позиции ЛКМ в справочник.
 * Запуск: node scripts/seed-coating-materials.js <companyId>
 * Пример:  node scripts/seed-coating-materials.js "uuid-вашей-компании"
 *
 * Данные по расходу и ТСП — из технических паспортов производителей (ГОСТ):
 *   ГФ-021  ГОСТ 25129-82  — грунтовка алкидная
 *   ПФ-115  ГОСТ 6465-76   — эмаль алкидная
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const MATERIALS = [
  {
    code:                       'ГФ-021',
    name:                       'Грунтовка ГФ-021 (алкидная)',
    coatingType:                'PRIMER',
    // Расход по ГОСТ 25129-82: 70–120 г/м² за 1 слой при ТСП 15–25 мкм
    // Берём середину диапазона: 90 г/м² при 20 мкм
    consumptionGm2:             90,
    referenceDftMkm:            20,
    densityKgL:                 1.10,
    recommendedDilutionPercent: 10,   // уайт-спирит или сольвент
    pricePerKg:                 null, // заполнить по факту закупки
    supplierName:               null,
    notes:                      'ГОСТ 25129-82. Разбавитель: уайт-спирит, сольвент. Нанесение: кисть/распылитель. Межслойная сушка 30 мин при 20°C.',
  },
  {
    code:                       'ПФ-115',
    name:                       'Эмаль ПФ-115 (алкидная)',
    coatingType:                'TOPCOAT',
    // Расход по ГОСТ 6465-76: 100–140 г/м² за 1 слой при ТСП 25–35 мкм
    // Берём середину диапазона: 120 г/м² при 30 мкм
    consumptionGm2:             120,
    referenceDftMkm:            30,
    densityKgL:                 1.15,
    recommendedDilutionPercent: 7,    // уайт-спирит до 10%
    pricePerKg:                 null, // заполнить по факту закупки
    supplierName:               null,
    notes:                      'ГОСТ 6465-76. Разбавитель: уайт-спирит до 10%. Нанесение: кисть/валик/распылитель. Полное высыхание 24 ч при 20°C.',
  },
]

async function main() {
  const companyId = process.argv[2]
  if (!companyId) {
    console.error('Usage: node scripts/seed-coating-materials.js <companyId>')
    process.exit(1)
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) {
    console.error(`Company not found: ${companyId}`)
    process.exit(1)
  }

  console.log(`Seeding coating materials for company: ${company.name} (${companyId})\n`)

  for (const mat of MATERIALS) {
    const existing = await prisma.coatingMaterial.findFirst({
      where: { companyId, code: mat.code },
    })
    if (existing) {
      console.log(`  SKIP  ${mat.code} — already exists (id: ${existing.id})`)
      continue
    }
    const created = await prisma.coatingMaterial.create({
      data: { companyId, ...mat },
    })
    console.log(`  OK    ${created.code} — ${created.name}`)
    console.log(`        Расход: ${created.consumptionGm2} г/м² при ТСП ${created.referenceDftMkm} мкм`)
    console.log(`        Плотность: ${created.densityKgL} кг/л  Разбавитель: ${created.recommendedDilutionPercent}%`)
    console.log(`        id: ${created.id}\n`)
  }

  console.log('Done.')
}

main()
  .catch(e => { console.error(e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
