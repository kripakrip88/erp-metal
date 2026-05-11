const { calcLinearWeight, calcAreaWeight } = require('../calculations/weightCalc')
const { calcLinearPaint,  calcAreaPaint }  = require('../calculations/paintCalc')
const { calcMaterialCost }                 = require('../calculations/costCalc')

function calcPart(part, geo, pricePerTon, asmQty = 1) {
  let wpu = 0, totalW = 0, paint = 0

  if (part.measurementType === 'LINEAR' && part.length && geo.theoreticalWeightPerMeter) {
    const r = calcLinearWeight(Number(part.length), Number(geo.theoreticalWeightPerMeter), part.quantity * asmQty)
    wpu = r.weightPerUnit; totalW = r.totalWeight
    paint = calcLinearPaint(Number(part.length), geo.paintSurfacePerMeter ? Number(geo.paintSurfacePerMeter) : null, part.quantity * asmQty)
  } else if (part.measurementType === 'AREA' && part.sheetWidth && part.sheetHeight) {
    const r = calcAreaWeight(Number(part.sheetWidth), Number(part.sheetHeight), geo.weightPerSquareMeter ? Number(geo.weightPerSquareMeter) : 0, part.quantity * asmQty)
    wpu = r.weightPerUnit; totalW = r.totalWeight
    paint = calcAreaPaint(Number(part.sheetWidth), Number(part.sheetHeight), part.quantity * asmQty)
  }

  const cost = calcMaterialCost(totalW, pricePerTon || 0)
  return { weightPerUnit: wpu, totalWeight: totalW, paintM2: paint, cost }
}

module.exports = { calcPart }
