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

    if (!status) return json(res, { error: 'status is required' }, 400)

    let assembly
    if (erpAssemblyId) {
      assembly = await prisma.assembly.findUnique({ where: { id: erpAssemblyId } })
      if (!assembly) return json(res, { error: 'Assembly not found' }, 404)
      if (rfqId && assembly.orderId !== rfqId) {
        return json(res, { error: 'Assembly does not belong to rfqId' }, 400)
      }
    } else if (rfqId) {
      // No specific assembly — auto-create "Основной узел" for this order
      const order = await prisma.order.findUnique({ where: { id: rfqId } })
      if (!order) return json(res, { error: 'Order not found' }, 404)
      assembly = await prisma.assembly.create({
        data: { orderId: rfqId, name: 'Основной узел', description: null, qty: 1, position: 0 },
      })
    } else {
      return json(res, { error: 'erpAssemblyId or rfqId is required' }, 400)
    }

    const asmId = assembly.id

    if (status === 'failed') {
      await prisma.assembly.update({
        where: { id: asmId },
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
      where: { assemblyId: asmId, aiGenerated: true },
    })

    // Create Part records from BOM items
    await prisma.$transaction(
      rows.map((item, idx) =>
        prisma.part.create({
          data: {
            assemblyId:      asmId,
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
      where: { id: asmId },
      data:  { description: 'BOM требует подтверждения' },
    })

    console.log(`[bom-extracted] assembly ${asmId}: ${rows.length} parts created`)
    return json(res, { ok: true, itemsCreated: rows.length })
  }},
]
