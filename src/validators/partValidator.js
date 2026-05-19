const { z }        = require('zod')
const { parseZod } = require('../utils/zodParse')

const optNum = z.preprocess(
  v => (v != null && v !== '') ? Number(v) : null,
  z.number().nullable().optional(),
)

const CreatePartSchema = z.object({
  materialDefinitionId: z.string().min(1, 'materialDefinitionId обязателен'),
  name:            z.string().optional().nullable().default(null),
  measurementType: z.enum(['LINEAR', 'AREA', 'PIECE']).default('LINEAR'),
  length:          optNum,
  sheetWidth:      optNum,
  sheetHeight:     optNum,
  directWeightKg:  optNum,
  quantity:        z.coerce.number().int().min(1).default(1),
  notes:           z.string().optional().nullable().default(null),
  position:        z.coerce.number().int().default(0),
  bomTemplateCode:    z.string().optional().nullable().default(null),
  bomTemplateId:      z.string().optional().nullable().default(null),
  bomTemplateVersion: z.coerce.number().int().optional().nullable().default(null),
  bomGroupKey:        z.string().optional().nullable().default(null),
  bomGroupLabel:      z.string().optional().nullable().default(null),
  bomDepth:           z.coerce.number().int().optional().nullable().default(null),
  bomPath:            z.string().optional().nullable().default(null),
  bomSortPath:        z.string().optional().nullable().default(null),
  partCategory:       z.string().optional().nullable().default(null),
})

function validateCreatePart(body) {
  return parseZod(CreatePartSchema, body)
}

module.exports = { validateCreatePart }
