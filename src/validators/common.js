function required(value, field) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${field} обязательное поле`)
  }
  return value
}

function optionalStr(value) {
  return value || null
}

function optionalNum(value) {
  return value ? parseFloat(value) : null
}

module.exports = { required, optionalStr, optionalNum }
