function calcLinearWeight(lengthMm, kgPerMeter, qty) {
  const lenM = lengthMm / 1000
  const wpu  = Math.round(lenM * kgPerMeter * 10000) / 10000
  const total = Math.round(wpu * qty * 10000) / 10000
  return { weightPerUnit: wpu, totalWeight: total, lengthM: lenM }
}

function calcAreaWeight(widthMm, heightMm, kgPerM2, qty) {
  const areaM2 = (widthMm / 1000) * (heightMm / 1000)
  const wpu    = Math.round(areaM2 * kgPerM2 * 10000) / 10000
  const total  = Math.round(wpu * qty * 10000) / 10000
  return { weightPerUnit: wpu, totalWeight: total, areaM2 }
}

module.exports = { calcLinearWeight, calcAreaWeight }
