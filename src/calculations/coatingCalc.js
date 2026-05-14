/**
 * theoreticalConsumptionKg = (areaM2 * consumptionGm2) / 1000
 * finalConsumptionKg       = theoreticalConsumptionKg * (1 + lossFactor / 100)
 * lossFactorPercent = null → 0%
 */
function calcCoatingConsumption(areaM2, consumptionGm2, lossFactorPercent) {
  const theoretical = Math.round((areaM2 * consumptionGm2) / 1000 * 10000) / 10000
  const loss        = lossFactorPercent != null ? Number(lossFactorPercent) : 0
  const final       = Math.round(theoretical * (1 + loss / 100) * 10000) / 10000
  return { theoreticalConsumptionKg: theoretical, finalConsumptionKg: final }
}

module.exports = { calcCoatingConsumption }
