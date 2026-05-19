const busboy = require('busboy')
const crypto = require('crypto')
const path   = require('path')
const fs     = require('fs')

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB

// Parses a multipart/form-data request.
// Returns { fields, file: { originalName, storageName, mimeType, sizeBytes } }
// Resolves only after BOTH busboy and the write stream have finished.
async function parseMultipart(req, uploadDir) {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_BYTES } })
    const fields = {}
    let fileResult  = null
    let bbDone      = false
    let writerDone  = false
    let hasFile     = false

    function tryResolve() {
      if (bbDone && writerDone) resolve({ fields, file: fileResult })
    }

    bb.on('field', (name, val) => { fields[name] = val })

    bb.on('file', (name, stream, info) => {
      hasFile = true
      const { filename, mimeType } = info
      const ext         = path.extname(filename || '') || ''
      const storageName = crypto.randomUUID() + ext
      const fullPath    = path.join(uploadDir, storageName)
      const writer      = fs.createWriteStream(fullPath)
      let sizeBytes     = 0

      stream.on('limit', () => {
        writer.destroy()
        fs.unlink(fullPath, () => {})
        reject(Object.assign(new Error('File exceeds 50 MB limit'), { status: 413 }))
      })

      stream.on('data', chunk => { sizeBytes += chunk.length })
      stream.pipe(writer)

      writer.on('finish', () => {
        fileResult = { originalName: filename, storageName, mimeType, sizeBytes }
        writerDone = true
        tryResolve()
      })
      writer.on('error', reject)
    })

    bb.on('finish', () => {
      bbDone = true
      // No file field in this request — mark writer as done so we can resolve
      if (!hasFile) writerDone = true
      tryResolve()
    })

    bb.on('error', reject)
    req.pipe(bb)
  })
}

module.exports = { parseMultipart }
