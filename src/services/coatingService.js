const prisma = require('../repositories/prisma')
const { calcLinearPaint, calcAreaPaint } = require('../calculations/paintCalc')
const { calcCoatingConsumption }         = require('../calculations/coatingCalc')
const { calcCoatingCost }                = require('../calculations/coatingCostCalc')

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _companyId() {
  const c = await prisma.company.findFirst()
  if (!c) throw new Error('Company not found')
  return c.id
}

// ─── Coating Material catalog ─────────────────────────────────────────────

async function listCoatingMaterials() {
  const companyId = await _companyId()
  return prisma.coatingMaterial.findMany({
    where: { companyId, isActive: true },
    orderBy: [{ coatingType: 'asc' }, { code: 'asc' }],
  })
}

async function createCoatingMaterial(data) {
  const companyId = await _companyId()
  return prisma.coatingMaterial.create({
    data: { companyId, ...data },
  })
}

async function updateCoatingMaterial(id, data) {
  return prisma.coatingMaterial.update({ where: { id }, data })
}

// ─── Consumption calculation helpers ─────────────────────────────────────────

// Computes total paint area (m²) for an assembly from its parts.
// client = prisma or a transaction tx.
async function _assemblyPaintAreaM2(client, assemblyId) {
  const asm = await client.assembly.findUnique({
    where: { id: assemblyId },
    include: { parts: { include: { materialDefinition: { include: { geometry: true } } } } },
  })
  if (!asm) return 0
  const asmQty = asm.qty || 1
  let area = 0
  for (const part of asm.parts) {
    const geo = part.materialDefinition?.geometry
    if (!geo) continue
    if (part.measurementType === 'LINEAR' && part.length) {
      area += calcLinearPaint(Number(part.length), geo.paintSurfacePerMeter ? Number(geo.paintSurfacePerMeter) : null, part.quantity * asmQty)
    } else if (part.measurementType === 'AREA' && part.sheetWidth && part.sheetHeight) {
      area += calcAreaPaint(Number(part.sheetWidth), Number(part.sheetHeight), part.quantity * asmQty)
    }
  }
  return Math.round(area * 10000) / 10000
}

// Resolves effective areaM2 and returns consumption calc fields.
async function _resolveConsumption(client, assemblyId, coating, mat) {
  const areaM2 = coating.autoAreaLink
    ? await _assemblyPaintAreaM2(client, assemblyId)
    : Number(coating.manualAreaM2 || 0)
  return calcCoatingConsumption(areaM2, Number(mat.consumptionGm2), coating.lossFactorPercent)
}

// ─── Assembly coatings ────────────────────────────────────────────────────

async function listAssemblyCoatings(assemblyId) {
  return prisma.assemblyCoating.findMany({
    where: { assemblyId },
    include: { coatingMaterial: true },
    orderBy: { position: 'asc' },
  })
}

async function createAssemblyCoating(assemblyId, data) {
  const last = await prisma.assemblyCoating.findFirst({
    where: { assemblyId },
    orderBy: { position: 'desc' },
  })
  const position = last ? last.position + 1 : 0
  const layerNumber = data.layerNumber ?? (last ? last.layerNumber + 1 : 1)

  // Resolve snapshot fields from material if not provided
  let materialCodeSnapshot = data.materialCodeSnapshot ?? null
  let materialNameSnapshot = data.materialNameSnapshot ?? null
  const mat = await prisma.coatingMaterial.findUnique({
    where: { id: data.coatingMaterialId },
    select: { code: true, name: true, consumptionGm2: true, pricePerKg: true },
  })
  if (!materialCodeSnapshot) materialCodeSnapshot = mat?.code ?? null
  if (!materialNameSnapshot) materialNameSnapshot = mat?.name ?? null
  const costSnapshotPerKg = data.costSnapshotPerKg ?? mat?.pricePerKg ?? null

  const draft = {
    assemblyId,
    coatingMaterialId:    data.coatingMaterialId,
    coatingSystemId:      data.coatingSystemId    ?? null,
    layerNumber,
    autoAreaLink:         data.autoAreaLink        ?? true,
    manualAreaM2:         data.manualAreaM2        ?? null,
    selectedDftMkm:       data.selectedDftMkm      ?? null,
    dilutionPercent:      data.dilutionPercent      ?? null,
    lossFactorPercent:    data.lossFactorPercent    ?? null,
    notes:                data.notes               ?? null,
    position,
    materialCodeSnapshot,
    materialNameSnapshot,
    costSnapshotPerKg,
  }
  const { theoreticalConsumptionKg, finalConsumptionKg } =
    await _resolveConsumption(prisma, assemblyId, draft, mat)
  const { calculatedCost } = calcCoatingCost(finalConsumptionKg, costSnapshotPerKg)
  return prisma.assemblyCoating.create({
    data: { ...draft, theoreticalConsumptionKg, finalConsumptionKg, calculatedCost },
    include: { coatingMaterial: true },
  })
}

// Recomputes consumption and cost for a single AssemblyCoating by id.
async function recalculateAssemblyCoating(coatingId) {
  const coating = await prisma.assemblyCoating.findUnique({
    where: { id: coatingId },
    include: { coatingMaterial: true },
  })
  if (!coating) throw new Error('AssemblyCoating not found')
  const { theoreticalConsumptionKg, finalConsumptionKg } =
    await _resolveConsumption(prisma, coating.assemblyId, coating, coating.coatingMaterial)
  const { calculatedCost } = calcCoatingCost(finalConsumptionKg, coating.costSnapshotPerKg)
  return prisma.assemblyCoating.update({
    where: { id: coatingId },
    data: { theoreticalConsumptionKg, finalConsumptionKg, calculatedCost },
    include: { coatingMaterial: true },
  })
}

// Recomputes consumption for all coatings of an assembly (e.g. after parts change).
async function recalculateAssemblyCoatings(assemblyId) {
  const coatings = await prisma.assemblyCoating.findMany({
    where: { assemblyId },
    include: { coatingMaterial: true },
    orderBy: { position: 'asc' },
  })
  // autoAreaLink rows share the same area — compute once
  let autoArea = null
  const updates = []
  for (const coating of coatings) {
    let areaM2
    if (coating.autoAreaLink) {
      if (autoArea === null) autoArea = await _assemblyPaintAreaM2(prisma, assemblyId)
      areaM2 = autoArea
    } else {
      areaM2 = Number(coating.manualAreaM2 || 0)
    }
    const { theoreticalConsumptionKg, finalConsumptionKg } =
      calcCoatingConsumption(areaM2, Number(coating.coatingMaterial.consumptionGm2), coating.lossFactorPercent)
    const { calculatedCost } = calcCoatingCost(finalConsumptionKg, coating.costSnapshotPerKg)
    updates.push(prisma.assemblyCoating.update({
      where: { id: coating.id },
      data: { theoreticalConsumptionKg, finalConsumptionKg, calculatedCost },
    }))
  }
  return prisma.$transaction(updates)
}

async function applyCoatingSystem(assemblyId, coatingSystemId, options = {}) {
  const replaceExisting = options.replaceExisting ?? false

  return prisma.$transaction(async (tx) => {
    // Verify assembly exists and capture companyId for cross-tenant guard
    const assembly = await tx.assembly.findUnique({
      where: { id: assemblyId },
      select: { id: true, order: { select: { companyId: true } } },
    })
    if (!assembly) throw new Error('Assembly not found')

    const system = await tx.coatingSystem.findUnique({
      where: { id: coatingSystemId },
      include: {
        layers: {
          include: { coatingMaterial: true },
          orderBy: { position: 'asc' },
        },
      },
    })
    if (!system) throw new Error('CoatingSystem not found')
    if (!system.isActive) throw new Error('CoatingSystem is inactive')
    if (system.layers.length === 0) throw new Error('CoatingSystem has no layers')

    // Cross-company guard: system and assembly must belong to the same tenant
    if (system.companyId !== assembly.order.companyId) {
      throw new Error('CoatingSystem does not belong to the same company as the assembly')
    }

    if (replaceExisting) {
      await tx.assemblyCoating.deleteMany({ where: { assemblyId } })
    }
    // replaceExisting=false: new layers are appended, existing ones preserved

    // Single aggregate: get both max position and max layerNumber in one query
    const maxes = replaceExisting ? null : await tx.assemblyCoating.aggregate({
      where: { assemblyId },
      _max: { position: true, layerNumber: true },
    })
    const posOffset   = maxes?._max.position    != null ? maxes._max.position    + 1 : 0
    const layerOffset = maxes?._max.layerNumber != null ? maxes._max.layerNumber      : 0

    // All new layers use autoAreaLink=true — compute area once for the batch
    const autoAreaM2 = await _assemblyPaintAreaM2(tx, assemblyId)

    // Create independent runtime copies — snapshot origin, not live references
    const rows = system.layers.map(layer => {
      const { theoreticalConsumptionKg, finalConsumptionKg } = calcCoatingConsumption(
        autoAreaM2,
        Number(layer.coatingMaterial.consumptionGm2),
        null  // lossFactorPercent unknown at apply time — user sets after
      )
      const costSnapshotPerKg = layer.coatingMaterial.pricePerKg ?? null
      const { calculatedCost } = calcCoatingCost(finalConsumptionKg, costSnapshotPerKg)
      return {
        assemblyId,
        coatingMaterialId:         layer.coatingMaterialId,
        coatingSystemId,
        layerNumber:               layerOffset + layer.layerNumber,
        autoAreaLink:              true,
        manualAreaM2:              null,
        selectedDftMkm:            layer.defaultDftMkm         ?? null,
        dilutionPercent:           layer.defaultDilutionPercent ?? null,
        notes:                     layer.notes                  ?? null,
        position:                  posOffset + layer.position,
        materialCodeSnapshot:      layer.coatingMaterial.code,
        materialNameSnapshot:      layer.coatingMaterial.name,
        theoreticalConsumptionKg,
        finalConsumptionKg,
        costSnapshotPerKg,
        calculatedCost,
      }
    })

    // createMany bypasses Prisma middleware/hooks — snapshot and calculation
    // fields must be fully computed before insert (no post-create triggers available).
    // TODO: if audit/event/revision hooks appear, replace with batched create pipeline
    //   (individual tx.assemblyCoating.create per row) to trigger middleware per insert.
    await tx.assemblyCoating.createMany({ data: rows })

    return tx.assemblyCoating.findMany({
      where: { assemblyId },
      include: { coatingMaterial: true },
      orderBy: { position: 'asc' },
    })
  })
}

// TODO: optimistic locking — add revision Int @default(1) to AssemblyCoating;
//   check-and-increment on every update to prevent concurrent overwrites.
async function updateAssemblyCoating(coatingId, data) {
  const existing = await prisma.assemblyCoating.findUnique({
    where: { id: coatingId },
    select: { assemblyId: true, coatingMaterialId: true, costSnapshotPerKg: true },
  })
  if (!existing) throw new Error('AssemblyCoating not found')

  const mat = await prisma.coatingMaterial.findUnique({
    where: { id: data.coatingMaterialId },
    select: { code: true, name: true, consumptionGm2: true, pricePerKg: true },
  })

  // Snapshot precedence:
  // 1. Caller explicitly supplied costSnapshotPerKg → honour it (manual override)
  // 2. coatingMaterialId changed → auto-refresh from new material's catalog price
  // 3. Same material, no override → preserve existing snapshot unchanged
  let costSnapshotPerKg
  if (data.costSnapshotPerKg !== undefined) {
    costSnapshotPerKg = data.costSnapshotPerKg ?? null
  } else if (data.coatingMaterialId !== existing.coatingMaterialId) {
    costSnapshotPerKg = mat?.pricePerKg ?? null
  } else {
    costSnapshotPerKg = existing.costSnapshotPerKg
  }

  const draft = {
    coatingMaterialId:    data.coatingMaterialId,
    layerNumber:          data.layerNumber,
    autoAreaLink:         data.autoAreaLink,
    manualAreaM2:         data.manualAreaM2     ?? null,
    selectedDftMkm:       data.selectedDftMkm   ?? null,
    dilutionPercent:      data.dilutionPercent   ?? null,
    lossFactorPercent:    data.lossFactorPercent ?? null,
    notes:                data.notes ?? null,
    materialCodeSnapshot: mat?.code ?? null,
    materialNameSnapshot: mat?.name ?? null,
    costSnapshotPerKg,
  }
  const { theoreticalConsumptionKg, finalConsumptionKg } =
    await _resolveConsumption(prisma, existing.assemblyId, draft, mat)
  const { calculatedCost } = calcCoatingCost(finalConsumptionKg, costSnapshotPerKg)
  return prisma.assemblyCoating.update({
    where: { id: coatingId },
    data: { ...draft, theoreticalConsumptionKg, finalConsumptionKg, calculatedCost },
    include: { coatingMaterial: true },
  })
}

// TODO: hard delete — future: soft-delete via deletedAt or capture revision snapshot
//   before delete to preserve coating history for deterministic ERP revision reproduction.
async function deleteAssemblyCoating(coatingId) {
  return prisma.assemblyCoating.delete({ where: { id: coatingId } })
}

module.exports = {
  listCoatingMaterials, createCoatingMaterial, updateCoatingMaterial,
  listAssemblyCoatings, createAssemblyCoating, updateAssemblyCoating, deleteAssemblyCoating,
  recalculateAssemblyCoating,
  recalculateAssemblyCoatings,
  applyCoatingSystem,
}
