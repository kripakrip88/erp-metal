const { Prisma } = require('@prisma/client')

// theoreticalConsumptionKg = (areaM2 * consumptionGm2) / 1000
// finalConsumptionKg       = theoreticalConsumptionKg * (1 + lossFactor / 100)
// Prisma.Decimal throughout — float arithmetic accumulates rounding errors across ERP quote totals.
// TODO: consumption normalization versioning (formula version field for audit trail)
function calcCoatingConsumption(areaM2, consumptionGm2, lossFactorPercent) {
  const area = new Prisma.Decimal(areaM2 ?? 0)
  const cons = new Prisma.Decimal(consumptionGm2 ?? 0)
  const loss = lossFactorPercent != null ? new Prisma.Decimal(lossFactorPercent) : new Prisma.Decimal(0)

  const theoretical = area.mul(cons).div(1000).toDecimalPlaces(4)
  const final       = theoretical.mul(new Prisma.Decimal(1).add(loss.div(100))).toDecimalPlaces(4)

  return { theoreticalConsumptionKg: theoretical, finalConsumptionKg: final }
}

module.exports = { calcCoatingConsumption }
