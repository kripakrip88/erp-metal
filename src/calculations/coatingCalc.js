const { Prisma } = require('@prisma/client')

// theoreticalConsumptionKg = (areaM2 * effectiveConsumptionGm2) / 1000
// finalConsumptionKg       = theoreticalConsumptionKg * (1 + lossFactor / 100)
// effectiveConsumptionGm2  = consumptionGm2 * (selectedDftMkm / referenceDftMkm)  — when DFT override is set
// Prisma.Decimal throughout — float arithmetic accumulates rounding errors across ERP quote totals.
// TODO: calculationFormulaVersion field per AssemblyCoating row — deterministic reproduction
//   of historical ERP revisions when consumption formula changes.
function calcCoatingConsumption(areaM2, consumptionGm2, lossFactorPercent, referenceDftMkm, selectedDftMkm) {
  const area = new Prisma.Decimal(areaM2 ?? 0)
  let cons = new Prisma.Decimal(consumptionGm2 ?? 0)

  // Scale consumption proportionally when user overrides DFT
  if (selectedDftMkm != null && referenceDftMkm != null && referenceDftMkm > 0) {
    cons = cons.mul(new Prisma.Decimal(selectedDftMkm)).div(new Prisma.Decimal(referenceDftMkm))
  }

  const loss = lossFactorPercent != null ? new Prisma.Decimal(lossFactorPercent) : new Prisma.Decimal(0)

  const theoretical = area.mul(cons).div(1000).toDecimalPlaces(4)
  const final       = theoretical.mul(new Prisma.Decimal(1).add(loss.div(100))).toDecimalPlaces(4)

  return { theoreticalConsumptionKg: theoretical, finalConsumptionKg: final }
}

module.exports = { calcCoatingConsumption }
