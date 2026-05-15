const { Prisma } = require('@prisma/client')

// calculatedCost = finalConsumptionKg * costSnapshotPerKg
// Returns null if either input is null — cost cannot be derived without both values.
// NOTE: calculatedCost is a snapshot-derived ESTIMATE — NOT an accounting fact.
//   Do not use for procurement, invoicing, or financial reporting.
function calcCoatingCost(finalConsumptionKg, costSnapshotPerKg) {
  if (finalConsumptionKg == null || costSnapshotPerKg == null) {
    return { calculatedCost: null }
  }
  const consumption = new Prisma.Decimal(finalConsumptionKg)
  const price       = new Prisma.Decimal(costSnapshotPerKg)
  const calculatedCost = consumption.mul(price).toDecimalPlaces(2)
  return { calculatedCost }
}

// TODO: ERP finance layer —
//   currency support + FX snapshots per coating layer
//   supplier quotations + procurement integration
//   estimate export (PDF/XLSX cost breakdown)
//   ERP revision pricing (lock cost at revision create time)
//   margin engine (target margin % → selling price)
//   profitability KPI (actual vs estimated cost per assembly)
//   calculationFormulaVersion + pricingFormulaVersion per row —
//     deterministic reproduction of historical ERP revisions when formulas change

module.exports = { calcCoatingCost }
