const { z }        = require('zod')
const { parseZod } = require('../utils/zodParse')

const VALID_COATING_TYPES = ['PRIMER', 'BASE_COAT', 'TOPCOAT', 'CLEAR', 'OTHER']

const positiveInt     = z.coerce.number().int().min(1)
const nonNegativeInt  = z.coerce.number().int().min(0)
const positiveDecimal = z.coerce.number().positive()
const dilutionPct     = z.coerce.number().min(0).max(100)

// ─── Coating material ────────────────────────────────────────────────────────

const CoatingMaterialSchema = z.object({
  code:             z.string().min(1, 'code обязателен'),
  name:             z.string().min(1, 'name обязателен'),
  coatingType:      z.enum(VALID_COATING_TYPES, {
    errorMap: () => ({ message: `coatingType должен быть одним из: ${VALID_COATING_TYPES.join(', ')}` }),
  }),
  consumptionGm2:             positiveDecimal,
  referenceDftMkm:            positiveInt,
  densityKgL:                 positiveDecimal,
  recommendedDilutionPercent: dilutionPct.optional().nullable().default(null),
  pricePerKg:    positiveDecimal.optional().nullable().default(null),
  supplierName:  z.string().optional().nullable().default(null),
  notes:         z.string().optional().nullable().default(null),
})

function validateCoatingMaterial(body) {
  return parseZod(CoatingMaterialSchema, body)
}

// ─── Assembly coating (runtime instance) ────────────────────────────────────

const AssemblyCoatingSchema = z.object({
  coatingMaterialId: z.string().min(1, 'coatingMaterialId обязателен'),
  layerNumber:       positiveInt.optional().nullable().default(null),
  autoAreaLink:      z.boolean().optional().default(true),
  manualAreaM2:      positiveDecimal.optional().nullable().default(null),
  selectedDftMkm:    positiveInt.optional().nullable().default(null),
  dilutionPercent:   dilutionPct.optional().nullable().default(null),
  lossFactorPercent: dilutionPct.optional().nullable().default(null),
  costSnapshotPerKg: positiveDecimal.optional(),
  notes:             z.string().optional().nullable().default(null),
})

function validateAssemblyCoating(body) {
  if (body.calculatedCost !== undefined) {
    throw Object.assign(
      new Error('calculatedCost — derived field, cannot be set directly'),
      { status: 400 },
    )
  }
  return parseZod(AssemblyCoatingSchema, body)
}

// ─── Coating system layer (template) ────────────────────────────────────────

const CoatingSystemLayerSchema = z.object({
  coatingMaterialId:      z.string().min(1, 'coatingMaterialId обязателен'),
  layerNumber:            positiveInt,
  position:               nonNegativeInt.default(0),
  defaultDftMkm:          positiveInt.optional().nullable().default(null),
  defaultDilutionPercent: dilutionPct.optional().nullable().default(null),
  notes:                  z.string().optional().nullable().default(null),
})

function validateCoatingSystemLayer(body) {
  return parseZod(CoatingSystemLayerSchema, body)
}

// ─── Coating system (template header) ───────────────────────────────────────

const CoatingSystemSchema = z.object({
  code:        z.string().min(1, 'code обязателен'),
  name:        z.string().min(1, 'name обязателен'),
  description: z.string().optional().nullable().default(null),
  isActive:    z.boolean().default(true),
  position:    nonNegativeInt.default(0),
  uiColor:     z.string().optional().nullable().default(null),
})

function validateCoatingSystem(body) {
  return parseZod(CoatingSystemSchema, body)
}

module.exports = {
  validateCoatingMaterial,
  validateAssemblyCoating,
  validateCoatingSystemLayer,
  validateCoatingSystem,
}
