const { Prisma } = require('@prisma/client')

// calculatedCost = finalConsumptionKg * costSnapshotPerKg
// Returns null if either input is null — cost cannot be derived without both values.
function calcCoatingCost(finalConsumptionKg, costSnapshotPerKg) {
  if (finalConsumptionKg == null || costSnapshotPerKg == null) {
    return { calculatedCost: null }
  }
  const consumption = new Prisma.Decimal(finalConsumptionKg)
  const price       = new Prisma.Decimal(costSnapshotPerKg)
  const calculatedCost = consumption.mul(price).toDecimalPlaces(2)
  return { calculatedCost }
}

module.exports = { calcCoatingCost }
