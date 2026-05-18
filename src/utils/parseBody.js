const MAX_BODY_BYTES = 10 * 1024 * 1024 // 10 MB

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    let size = 0

    req.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        req.destroy()
        return reject(Object.assign(new Error('Request body too large (max 10MB)'), { status: 413 }))
      }
      body += chunk
    })

    req.on('end', () => {
      if (!body) return resolve({})
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(Object.assign(new Error('Invalid JSON in request body'), { status: 400 }))
      }
    })

    req.on('error', reject)
  })
}

module.exports = { parseBody }
