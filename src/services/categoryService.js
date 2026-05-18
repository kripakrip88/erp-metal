const prisma = require('../repositories/prisma')
const { getCompanyId } = require('../utils/company')

async function listCategories() {
  const companyId = await getCompanyId()

  const rows = await prisma.materialCategory.findMany({
    where: { companyId, deletedAt: null },
    include: { children: { where: { deletedAt: null }, orderBy: { position: 'asc' } } },
    orderBy: { position: 'asc' },
  })

  return rows.filter(r => r.parentId === null)
}

async function createCategory({ slug, name, parentId, position }) {
  const companyId = await getCompanyId()

  return prisma.materialCategory.create({
    data: { companyId, slug, name, parentId: parentId ?? null, position: position ?? 0 },
  })
}

async function updateCategory(id, { slug, name, parentId, position, isActive }) {
  if (parentId !== undefined && parentId === id) {
    throw Object.assign(new Error('Category cannot be its own parent'), { status: 400 })
  }

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
