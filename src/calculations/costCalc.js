function calcMaterialCost(weightKg, pricePerTon) {
  if (!pricePerTon) return 0
  return Math.round(weightKg / 1000 * pricePerTon * 10000) / 10000
}

module.exports = { calcMaterialCost }
