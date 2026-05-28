const MATERIAL_TYPES    = ['STEEL', 'STAINLESS', 'ALUMINUM', 'GALVANIZED']
const PROFILE_TYPES     = ['RECTANGULAR_TUBE', 'ROUND_TUBE', 'ANGLE', 'CHANNEL', 'BEAM', 'SHEET', 'PLATE', 'FLAT_BAR', 'ROUND_BAR', 'FASTENER']
const MEASUREMENT_TYPES = ['LINEAR', 'AREA', 'PIECE']
const STEEL_GRADES      = ['S235', 'S245', 'S345', 'S355', 'S09G2S', 'AISI304', 'AISI316', 'OTHER']
const PIECE_UNITS       = ['pcs', 'set', 'pack', 'pair']
const MATERIAL_DOMAINS  = ['STRUCTURAL', 'FASTENER']

function validateMaterial(body) {
  if (!body.code) throw Object.assign(new Error('code обязателен'), { status: 400 })
  if (!body.name) throw Object.assign(new Error('name обязателен'), { status: 400 })

  const isFastener = body.materialDomain === 'FASTENER'

  // Fasteners always use PIECE measurement and FASTENER profile type
  const profileType     = isFastener ? 'FASTENER'    : body.profileType
  const materialType    = body.materialType || 'STEEL'
  const measurementType = isFastener ? 'PIECE'        : body.measurementType

  if (!MATERIAL_TYPES.includes(materialType))
    throw Object.assign(new Error('invalid materialType'), { status: 400 })
  if (!PROFILE_TYPES.includes(profileType))
    throw Object.assign(new Error('invalid profileType'), { status: 400 })
  if (!MEASUREMENT_TYPES.includes(measurementType))
    throw Object.assign(new Error('invalid measurementType'), { status: 400 })

  const num = (v) => (v != null && v !== '') ? Number(v) : null

  const unitWeightKg = num(body.unitWeightKg)
  if (measurementType === 'PIECE' && unitWeightKg !== null && unitWeightKg < 0)
    throw Object.assign(new Error('unitWeightKg должен быть >= 0'), { status: 400 })

  return {
    code:         String(body.code).trim(),
    name:         String(body.name).trim(),
    materialType,
    profileType,
    measurementType,
    materialDomain: MATERIAL_DOMAINS.includes(body.materialDomain) ? body.materialDomain : 'STRUCTURAL',
    steelGrade:   STEEL_GRADES.includes(body.steelGrade) ? body.steelGrade : null,
    categoryId:   body.categoryId || null,
    standard:     body.standard   || null,
    strengthClass: body.strengthClass || null,
    pieceUnit:    PIECE_UNITS.includes(body.pieceUnit) ? body.pieceUnit : 'pcs',
    theoreticalWeightPerMeter: num(body.theoreticalWeightPerMeter),
    weightPerSquareMeter:      num(body.weightPerSquareMeter),
    paintSurfacePerMeter:      num(body.paintSurfacePerMeter),
    unitWeightKg,
  }
}

module.exports = { validateMaterial }
