function calcLinearPaint(lengthMm, paintM2perM, qty) {
  if (!paintM2perM) return 0
  const lenM = lengthMm / 1000
  return Math.round(lenM * paintM2perM * qty * 10000) / 10000
}

function calcAreaPaint(widthMm, heightMm, qty) {
  const areaM2 = (widthMm / 1000) * (heightMm / 1000)
  return Math.round(areaM2 * 2 * qty * 10000) / 10000
}

module.exports = { calcLinearPaint, calcAreaPaint }
