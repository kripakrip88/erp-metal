function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  // BigInt (e.g. sizeBytes in FileVersion) is not JSON-serializable by default
  res.end(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? Number(v) : v))
}
module.exports = { json }
