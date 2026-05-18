const templateRepo   = require('../repositories/templateRepo')
const prisma         = require('../repositories/prisma')
const { getCompany } = require('../utils/company')

const MAX_DEPTH = 3

// ─── Templates ───────────────────────────────────────────────────────────────

async function listTemplates() {
  const company = await getCompany()
  if (!company) return []
  return templateRepo.findAll(company.id)
}

async function getTemplate(id) {
  return templateRepo.findById(id)
}

async function createTemplate({ code, name, description }) {
  const company = await getCompany()
  if (!company)  throw new Error('Company not found')
  if (!code)     throw new Error('code обязательное поле')
  if (!name)     throw new Error('name обязательное поле')
  return templateRepo.create({ companyId: company.id, code, name, description: description || null })
}

async function updateTemplate(id, { code, name, description, isActive }) {
  const data = {}
  if (code        !== undefined) data.code        = code
  if (name        !== undefined) data.name        = name
  if (description !== undefined) data.description = description
  if (isActive    !== undefined) data.isActive    = isActive
  return templateRepo.update(id, data)
}

async function deleteTemplate(id) {
  return templateRepo.softDelete(id)
}

// ─── Nodes ───────────────────────────────────────────────────────────────────

async function getNodeDepth(nodeId) {
  let depth = 1
  let current = await templateRepo.findNode(nodeId)
  while (current && current.parentNodeId) {
    depth++
    current = await templateRepo.findNode(current.parentNodeId)
  }
  return depth
}

async function createNode(templateId, { parentNodeId, name, qty, position }) {
  if (!name) throw new Error('name обязательное поле')

  if (parentNodeId) {
    const parentDepth = await getNodeDepth(parentNodeId)
    if (parentDepth >= MAX_DEPTH) {
      throw new Error(`Максимальная глубина вложенности узлов: ${MAX_DEPTH}`)
    }
  }

  return templateRepo.createNode({
    templateId,
    parentNodeId: parentNodeId || null,
    name,
    qty:      qty != null ? parseInt(qty) : 1,
    position: position    ? parseInt(position) : 0,
  })
}

async function updateNode(nodeId, { name, qty, position }) {
  const data = {}
  if (name     !== undefined) data.name     = name
  if (qty      !== undefined) data.qty      = parseInt(qty)
  if (position !== undefined) data.position = parseInt(position)
  return templateRepo.updateNode(nodeId, data)
}

async function deleteNode(nodeId) {
  return templateRepo.deleteNode(nodeId)
}

// ─── Node Parts ───────────────────────────────────────────────────────────────

async function createNodePart(nodeId, body) {
  if (!body.materialDefinitionId) throw new Error('materialDefinitionId обязательное поле')
  if (!body.quantity)             throw new Error('quantity обязательное поле')

  return templateRepo.createNodePart({
    nodeId,
    materialDefinitionId: body.materialDefinitionId,
    measurementType:      body.measurementType || 'LINEAR',
    length:               body.length         ? parseFloat(body.length)         : null,
    sheetWidth:           body.sheetWidth      ? parseFloat(body.sheetWidth)     : null,
    sheetHeight:          body.sheetHeight     ? parseFloat(body.sheetHeight)    : null,
    directWeightKg:       body.directWeightKg  ? parseFloat(body.directWeightKg) : null,
    surfaceAreaM2:        body.surfaceAreaM2   ? parseFloat(body.surfaceAreaM2)  : null,
    quantity:             parseInt(body.quantity),
    notes:                body.notes    || null,
    position:             body.position ? parseInt(body.position) : 0,
  })
}

async function updateNodePart(partId, body) {
  const data = {}
  if (body.measurementType !== undefined) data.measurementType = body.measurementType
  if (body.length          !== undefined) data.length          = body.length         ? parseFloat(body.length)         : null
  if (body.sheetWidth      !== undefined) data.sheetWidth      = body.sheetWidth      ? parseFloat(body.sheetWidth)     : null
  if (body.sheetHeight     !== undefined) data.sheetHeight     = body.sheetHeight     ? parseFloat(body.sheetHeight)    : null
  if (body.directWeightKg  !== undefined) data.directWeightKg  = body.directWeightKg  ? parseFloat(body.directWeightKg) : null
  if (body.surfaceAreaM2   !== undefined) data.surfaceAreaM2   = body.surfaceAreaM2   ? parseFloat(body.surfaceAreaM2)  : null
  if (body.quantity        !== undefined) data.quantity        = parseInt(body.quantity)
  if (body.notes           !== undefined) data.notes           = body.notes || null
  if (body.position        !== undefined) data.position        = parseInt(body.position)
  return templateRepo.updateNodePart(partId, data)
}

async function deleteNodePart(partId) {
  return templateRepo.deleteNodePart(partId)
}

// ─── Apply template to Assembly ───────────────────────────────────────────────

function countTemplateParts(nodes) {
  let total = 0
  for (const node of nodes) {
    total += node.parts.length
    if (node.children) total += countTemplateParts(node.children)
  }
  return total
}

async function applyTemplateToAssembly(orderId, assemblyId, templateId, multiplier) {
  const m = multiplier != null ? parseInt(multiplier) : 1
  if (!m || m < 1) throw new Error('multiplier должен быть целым числом >= 1')

  const template = await templateRepo.findById(templateId)
  if (!template)        throw new Error('Шаблон не найден')
  if (!template.isActive || template.deletedAt)
                        throw new Error('Шаблон архивирован и недоступен для вставки')

  const totalParts = countTemplateParts(template.nodes)
  if (totalParts === 0) throw new Error('Шаблон не содержит деталей — вставка невозможна')

  const targetAssembly = await prisma.assembly.findUnique({ where: { id: assemblyId } })
  if (!targetAssembly)                    throw new Error('Assembly не найден')
  if (targetAssembly.orderId !== orderId) throw new Error('Assembly не принадлежит заказу')

  let totalCreated = 0

  await prisma.$transaction(async (tx) => {
    totalCreated = await cloneNodes(tx, template.nodes, orderId, assemblyId, m, {
      sourceTemplateId:      template.id,
      sourceTemplateVersion: template.version,
    })
  })

  return { ok: true, templateId, assemblyId, multiplier: m, nodesCreated: totalCreated }
}

// Вариант C: Assembly.qty = node.qty × multiplier, Part.quantity = templateNodePart.quantity
async function cloneNodes(tx, nodes, orderId, parentAssemblyId, multiplier, templateMeta) {
  let count = 0
  for (const node of nodes) {
    const isTopLevel = !!templateMeta
    const subAssembly = await tx.assembly.create({
      data: {
        orderId,
        parentId:             parentAssemblyId,
        name:                 node.name,
        qty:                  node.qty * multiplier,
        position:             node.position,
        ...(isTopLevel ? {
          sourceTemplateId:      templateMeta.sourceTemplateId,
          sourceTemplateVersion: templateMeta.sourceTemplateVersion,
        } : {}),
      },
    })
    count++

    for (const p of node.parts) {
      await tx.part.create({
        data: {
          assemblyId:           subAssembly.id,
          materialDefinitionId: p.materialDefinitionId,
          measurementType:      p.measurementType,
          length:               p.length,
          sheetWidth:           p.sheetWidth,
          sheetHeight:          p.sheetHeight,
          directWeightKg:       p.directWeightKg,
          surfaceAreaM2:        p.surfaceAreaM2,
          quantity:             p.quantity,
          notes:                p.notes,
          position:             p.position,
        },
      })
    }

    if (node.children && node.children.length > 0) {
      count += await cloneNodes(tx, node.children, orderId, subAssembly.id, multiplier, null)
    }
  }
  return count
}

module.exports = {
  listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
  createNode, updateNode, deleteNode,
  createNodePart, updateNodePart, deleteNodePart,
  applyTemplateToAssembly,
}
