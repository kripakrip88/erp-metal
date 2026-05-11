const { calcLinearWeight, calcAreaWeight } = require('./weightCalc')
const { calcLinearPaint, calcAreaPaint }   = require('./paintCalc')
const { calcMaterialCost }                 = require('./costCalc')

module.exports = {
  calcLinearWeight, calcAreaWeight,
  calcLinearPaint,  calcAreaPaint,
  calcMaterialCost,
}
