const { required } = require('./common')

function validateCreatePart(body) {
  required(body.materialDefinitionId, 'materialDefinitionId')
  required(body.quantity, 'quantity')
  return {
    materialDefinitionId: body.materialDefinitionId,
    name:            body.name || null,
    measurementType: body.measurementType || 'LINEAR',
    length:          body.length || null,
    sheetWidth:      body.sheetWidth || null,
    sheetHeight:     body.sheetHeight || null,
    quantity:        parseInt(body.quantity) || 1,
    notes:           body.notes || null,
    position:        body.position || 0,
  }
}

module.exports = { validateCreatePart }
