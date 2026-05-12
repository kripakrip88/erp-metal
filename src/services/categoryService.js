const prisma = require('../repositories/prisma')

async function getCompanyId() {
  const company = await prisma.company.findFirst({ select: { id: true } })
  return company?.id ?? null
}

async function listCategories() {
  const companyId = await getCompanyId()
  if (!companyId) return []

  const rows = await prisma.materialCategory.findMany({
    where: { companyId, deletedAt: null },
    include: { children: { where: { deletedAt: null }, orderBy: { position: 'asc' } } },
    orderBy: { position: 'asc' },
  })

  // Return only root categories (parentId === null); children are nested via include
  return rows.filter(r => r.parentId === null)
}

async function createCategory({ slug, name, parentId, position }) {
  const companyId = await getCompanyId()
  if (!companyId) throw new Error('Company not found')

  return prisma.materialCategory.create({
    data: { companyId, slug, name, parentId: parentId ?? null, position: position ?? 0 },
  })
}

async function updateCategory(id, { slug, name, parentId, position, isActive }) {
  const data = {}
  if (slug      !== undefined) data.slug     = slug
  if (name      !== undefined) data.name     = name
  if (parentId  !== undefined) data.parentId = parentId
  if (position  !== undefined) data.position = position
  if (isActive  !== undefined) data.isActive = isActive

  return prisma.materialCategory.update({ where: { id }, data })
}

async function deleteCategory(id) {
  return prisma.materialCategory.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  })
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory }
