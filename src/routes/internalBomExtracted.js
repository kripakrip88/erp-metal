const { json }      = require('../utils/response')
const { parseBody } = require('../utils/parseBody')
const prisma        = require('../repositories/prisma')

module.exports = [
  { method: 'POST', pathname: '/internal/bom-extracted', handler: async (req, res) => {
    let body
    try {
      body = await parseBody(req)
    } catch {
      return json(res, { error: 'Invalid JSON' }, 400)
    }

    const { rfqId, erpAssemblyId, status, items, error } = body

    if (!erpAssemblyId) return json(res, { error: 'erpAssemblyId is required' }, 400)
    if (!status)        return json(res, { error: 'status is required' }, 400)

    const assembly = await prisma.assembly.findUnique({ where: { id: erpAssemblyId } })
    if (!assembly) return json(res, { error: 'Assembly not found' }, 404)

    // Optional: verify assembly belongs to the given RFQ
    if (rfqId && assembly.orderId !== rfqId) {
      return json(res, { error: 'Assembly does not belong to rfqId' }, 400)
    }

    if (status === 'failed') {
      await prisma.assembly.update({
        where: { id: erpAssemblyId },
        data:  { description: `[AI ошибка] ${error || 'AI extraction failed'}` },
      })
      return json(res, { ok: true })
    }

    if (status !== 'completed') {
      return json(res, { error: `Unknown status: ${status}` }, 400)
    }

    const rows = Array.isArray(items) ? items : []

    // Delete any existing AI-generated parts to avoid duplicates on re-delivery
    await prisma.part.deleteMany({
      where: { assemblyId: erpAssemblyId, aiGenerated: true },
    })

    // Create Part records from BOM items
    await prisma.$transaction(
      rows.map((item, idx) =>
        prisma.part.create({
          data: {
            assemblyId:      erpAssemblyId,
            name:            item.name        || `Позиция ${item.position ?? idx + 1}`,
            measurementType: item.lengthMm != null ? 'LINEAR' : 'WEIGHT',
            length:          item.lengthMm != null ? parseFloat((item.lengthMm / 1000).toFixed(4)) : null,
            directWeightKg:  item.massTotalKg != null ? item.massTotalKg : null,
            quantity:        Math.max(1, Math.round(item.quantity || 1)),
            position:        item.position != null ? item.position : idx,
            aiGenerated:     true,
            aiConfidence:    item.confidence  != null ? item.confidence  : null,
            aiStatus:        'pending',
            aiRawText:       item.name        || null,
            notes: JSON.stringify({
              confidence:  item.confidence  ?? null,
              steelGrade:  item.steelGrade  ?? null,
              gost:        item.gost        ?? null,
              lengthMm:    item.lengthMm    ?? null,
              massTotalKg: item.massTotalKg ?? null,
              profileType: item.profileType ?? null,
            }),
          },
        })
      )
    )

    // Update assembly status
    await prisma.assembly.update({
      where: { id: erpAssemblyId },
      data:  { description: 'BOM требует подтверждения' },
    })

    console.log(`[bom-extracted] assembly ${erpAssemblyId}: ${rows.length} parts created`)
    return json(res, { ok: true, itemsCreated: rows.length })
  }},
]
