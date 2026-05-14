const { required } = require('./common')

const VALID_COATING_TYPES = ['PRIMER', 'BASE_COAT', 'TOPCOAT', 'CLEAR', 'OTHER']

function validateCoatingMaterial(body) {
  required(body.code, 'code')
  required(body.name, 'name')
  required(body.coatingType, 'coatingType')
  required(body.consumptionGm2, 'consumptionGm2')
  required(body.referenceDftMkm, 'referenceDftMkm')
  required(body.densityKgL, 'densityKgL')
  if (!VALID_COATING_TYPES.includes(body.coatingType)) {
    throw new Error(`coatingType must be one of: ${VALID_COATING_TYPES.join(', ')}`)
  }
  return {
    code:                       body.code,
    name:                       body.name,
    coatingType:                body.coatingType,
    consumptionGm2:             Number(body.consumptionGm2),
    referenceDftMkm:            parseInt(body.referenceDftMkm),
    densityKgL:                 Number(body.densityKgL),
    recommendedDilutionPercent: body.recommendedDilutionPercent != null ? Number(body.recommendedDilutionPercent) : null,
    pricePerKg:                 body.pricePerKg != null ? Number(body.pricePerKg) : null,
    supplierName:               body.supplierName || null,
    notes:                      body.notes        || null,
  }
}

function validateAssemblyCoating(body) {
  required(body.coatingMaterialId, 'coatingMaterialId')
  return {
    coatingMaterialId: body.coatingMaterialId,
    layerNumber:       body.layerNumber    != null ? parseInt(body.layerNumber)        : null,
    autoAreaLink:      body.autoAreaLink   != null ? Boolean(body.autoAreaLink)        : true,
    manualAreaM2:      body.manualAreaM2   != null ? Number(body.manualAreaM2)         : null,
    selectedDftMkm:    body.selectedDftMkm != null ? parseInt(body.selectedDftMkm)    : null,
    dilutionPercent:   body.dilutionPercent != null ? Number(body.dilutionPercent)     : null,
    notes:             body.notes          || null,
  }
}

module.exports = { validateCoatingMaterial, validateAssemblyCoating }
