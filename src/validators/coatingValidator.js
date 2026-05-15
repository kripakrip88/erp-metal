const { required } = require('./common')

const VALID_COATING_TYPES = ['PRIMER', 'BASE_COAT', 'TOPCOAT', 'CLEAR', 'OTHER']

// ─── Domain assertion helpers ────────────────────────────────────────────────

function positiveInt(value, field) {
  const n = parseInt(value)
  if (isNaN(n) || n <= 0) throw new Error(`${field} должен быть целым числом > 0`)
  return n
}

function nonNegativeInt(value, field) {
  const n = parseInt(value)
  if (isNaN(n) || n < 0) throw new Error(`${field} должен быть целым числом >= 0`)
  return n
}

function positiveDecimal(value, field) {
  const n = Number(value)
  if (isNaN(n) || n <= 0) throw new Error(`${field} должен быть числом > 0`)
  return n
}

function nonNegativeDecimal(value, field) {
  const n = Number(value)
  if (isNaN(n) || n < 0) throw new Error(`${field} должен быть числом >= 0`)
  return n
}

function dilutionPercent(value, field) {
  const n = Number(value)
  if (isNaN(n) || n < 0 || n > 100) throw new Error(`${field} должен быть числом от 0 до 100`)
  return n
}

// ─── Coating material ────────────────────────────────────────────────────────

function validateCoatingMaterial(body) {
  required(body.code, 'code')
  required(body.name, 'name')
  required(body.coatingType, 'coatingType')
  required(body.consumptionGm2, 'consumptionGm2')
  required(body.referenceDftMkm, 'referenceDftMkm')
  required(body.densityKgL, 'densityKgL')
  if (!VALID_COATING_TYPES.includes(body.coatingType)) {
    throw new Error(`coatingType должен быть одним из: ${VALID_COATING_TYPES.join(', ')}`)
  }
  return {
    code:                       body.code,
    name:                       body.name,
    coatingType:                body.coatingType,
    consumptionGm2:             positiveDecimal(body.consumptionGm2, 'consumptionGm2'),
    referenceDftMkm:            positiveInt(body.referenceDftMkm, 'referenceDftMkm'),
    densityKgL:                 positiveDecimal(body.densityKgL, 'densityKgL'),
    recommendedDilutionPercent: body.recommendedDilutionPercent != null
      ? dilutionPercent(body.recommendedDilutionPercent, 'recommendedDilutionPercent') : null,
    pricePerKg:    body.pricePerKg != null ? positiveDecimal(body.pricePerKg, 'pricePerKg') : null,
    supplierName:  body.supplierName || null,
    notes:         body.notes        || null,
  }
}

// ─── Assembly coating (runtime instance) ────────────────────────────────────

function validateAssemblyCoating(body) {
  if (body.calculatedCost !== undefined) throw new Error('calculatedCost — derived field, cannot be set directly')
  required(body.coatingMaterialId, 'coatingMaterialId')
  return {
    coatingMaterialId:  body.coatingMaterialId,
    layerNumber:        body.layerNumber        != null ? positiveInt(body.layerNumber, 'layerNumber')           : null,
    autoAreaLink:       body.autoAreaLink        != null ? Boolean(body.autoAreaLink)                             : true,
    manualAreaM2:       body.manualAreaM2        != null ? positiveDecimal(body.manualAreaM2, 'manualAreaM2')     : null,
    selectedDftMkm:     body.selectedDftMkm      != null ? positiveInt(body.selectedDftMkm, 'selectedDftMkm')    : null,
    dilutionPercent:    body.dilutionPercent      != null ? dilutionPercent(body.dilutionPercent, 'dilutionPercent') : null,
    lossFactorPercent:  body.lossFactorPercent    != null ? dilutionPercent(body.lossFactorPercent, 'lossFactorPercent') : null,
    costSnapshotPerKg:  body.costSnapshotPerKg    != null ? positiveDecimal(body.costSnapshotPerKg, 'costSnapshotPerKg') : undefined,
    notes:              body.notes || null,
  }
}

// ─── Coating system layer (template) ────────────────────────────────────────

function validateCoatingSystemLayer(body) {
  required(body.coatingMaterialId, 'coatingMaterialId')
  required(body.layerNumber, 'layerNumber')
  return {
    coatingMaterialId:      body.coatingMaterialId,
    layerNumber:            positiveInt(body.layerNumber, 'layerNumber'),
    position:               body.position != null ? nonNegativeInt(body.position, 'position') : 0,
    defaultDftMkm:          body.defaultDftMkm != null
      ? positiveInt(body.defaultDftMkm, 'defaultDftMkm') : null,
    defaultDilutionPercent: body.defaultDilutionPercent != null
      ? dilutionPercent(body.defaultDilutionPercent, 'defaultDilutionPercent') : null,
    notes: body.notes || null,
  }
}

// ─── Coating system (template header) ───────────────────────────────────────

function validateCoatingSystem(body) {
  required(body.code, 'code')
  required(body.name, 'name')
  return {
    code:        body.code,
    name:        body.name,
    description: body.description || null,
    isActive:    body.isActive != null ? Boolean(body.isActive) : true,
    position:    body.position != null ? nonNegativeInt(body.position, 'position') : 0,
    uiColor:     body.uiColor || null,
  }
}

module.exports = {
  validateCoatingMaterial,
  validateAssemblyCoating,
  validateCoatingSystemLayer,
  validateCoatingSystem,
}
