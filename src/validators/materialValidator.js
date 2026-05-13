const MATERIAL_TYPES    = ['STEEL', 'STAINLESS', 'ALUMINUM', 'GALVANIZED']
const PROFILE_TYPES     = ['RECTANGULAR_TUBE', 'ROUND_TUBE', 'ANGLE', 'CHANNEL', 'BEAM', 'SHEET', 'PLATE', 'FLAT_BAR', 'ROUND_BAR']
const MEASUREMENT_TYPES = ['LINEAR', 'AREA', 'PIECE']
const STEEL_GRADES      = ['S235', 'S245', 'S345', 'S355', 'S09G2S', 'AISI304', 'AISI316', 'OTHER']
const PIECE_UNITS       = ['pcs', 'set', 'pack', 'pair']

function validateMaterial(body) {
  if (!body.code)        throw Object.assign(new Error('code обязателен'), { status: 400 })
  if (!body.name)        throw Object.assign(new Error('name обязателен'), { status: 400 })
  if (!MATERIAL_TYPES.includes(body.materialType))
    throw Object.assign(new Error('invalid materialType'), { status: 400 })
  if (!PROFILE_TYPES.includes(body.profileType))
    throw Object.assign(new Error('invalid profileType'), { status: 400 })
  if (!MEASUREMENT_TYPES.includes(body.measurementType))
    throw Object.assign(new Error('invalid measurementType'), { status: 400 })

  const num = (v) => (v != null && v !== '') ? Number(v) : null

  return {
    code:         String(body.code).trim(),
    name:         String(body.name).trim(),
    materialType: body.materialType,
    profileType:  body.profileType,
    measurementType: body.measurementType,
    steelGrade:   STEEL_GRADES.includes(body.steelGrade)  ? body.steelGrade  : null,
    categoryId:   body.categoryId  || null,
    standard:     body.standard    || null,
    pieceUnit:    PIECE_UNITS.includes(body.pieceUnit) ? body.pieceUnit : null,
    theoreticalWeightPerMeter: num(body.theoreticalWeightPerMeter),
    weightPerSquareMeter:      num(body.weightPerSquareMeter),
    paintSurfacePerMeter:      num(body.paintSurfacePerMeter),
    unitWeightKg:              num(body.unitWeightKg),
  }
}

module.exports = { validateMaterial }
