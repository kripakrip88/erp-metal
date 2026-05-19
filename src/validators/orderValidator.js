const { z }        = require('zod')
const { parseZod } = require('../utils/zodParse')

const CreateOrderSchema = z.object({
  orderNumber:  z.string().default(() => `ORD-${Date.now()}`),
  customerName: z.string().min(1, 'customerName обязательное поле'),
  title:        z.string().min(1, 'title обязательное поле'),
  description:  z.string().optional().nullable().default(null),
  mode:         z.enum(['STANDARD', 'PHASED'], {
    errorMap: () => ({ message: 'mode должен быть STANDARD или PHASED' }),
  }).default('STANDARD'),
})

function validateCreateOrder(body) {
  return parseZod(CreateOrderSchema, body)
}

module.exports = { validateCreateOrder }
