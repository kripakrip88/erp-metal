const { z }        = require('zod')
const { parseZod } = require('../utils/zodParse')

const MATERIAL_TYPES    = ['STEEL', 'STAINLESS', 'ALUMINUM', 'GALVANIZED']
const PROFILE_TYPES     = ['RECTANGULAR_TUBE', 'ROUND_TUBE', 'ANGLE', 'CHANNEL', 'BEAM', 'SHEET', 'PLATE', 'FLAT_BAR', 'ROUND_BAR']
const MEASUREMENT_TYPES = ['LINEAR', 'AREA', 'PIECE']
const STEEL_GRADES      = ['S235', 'S245', 'S345', 'S355', 'S09G2S', 'AISI304', 'AISI316', 'OTHER']
const PIECE_UNITS       = ['pcs', 'set', 'pack', 'pair']

// Coerce non-empty values to number, everything else to null
const optNum = z.preprocess(
  v => (v != null && v !== '') ? Number(v) : null,
  z.number().nullable().optional(),
)

const MaterialSchema = z.object({
  code:            z.string().min(1, 'code обязателен').transform(v => v.trim()),
  name:            z.string().min(1, 'name обязателен').transform(v => v.trim()),
  materialType:    z.enum(MATERIAL_TYPES,    { errorMap: () => ({ message: 'invalid materialType' }) }),
  profileType:     z.enum(PROFILE_TYPES,     { errorMap: () => ({ message: 'invalid profileType' }) }),
  measurementType: z.enum(MEASUREMENT_TYPES, { errorMap: () => ({ message: 'invalid measurementType' }) }),
  // Non-enum fields: silently null if value not in allowed list (matches original behaviour)
  steelGrade:  z.enum(STEEL_GRADES).optional().nullable().catch(null).default(null),
  categoryId:  z.string().optional().nullable().default(null),
  standard:    z.string().optional().nullable().default(null),
  pieceUnit:   z.enum(PIECE_UNITS).optional().nullable().catch(null).default(null),
  theoreticalWeightPerMeter: optNum,
  weightPerSquareMeter:      optNum,
  paintSurfacePerMeter:      optNum,
  unitWeightKg:              optNum,
}).superRefine((data, ctx) => {
  if (data.measurementType === 'PIECE' && data.unitWeightKg != null && data.unitWeightKg < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'unitWeightKg должен быть >= 0',
      path: ['unitWeightKg'],
    })
  }
})

function validateMaterial(body) {
  return parseZod(MaterialSchema, body)
}

module.exports = { validateMaterial }
