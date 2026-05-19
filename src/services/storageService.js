const fs   = require('fs')
const path = require('path')

const UPLOADS_DIR = process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads')

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

function getStorageUrl(storageName) {
  return `/uploads/${storageName}`
}

function deleteStoredFile(storageName) {
  try {
    const fullPath = path.join(UPLOADS_DIR, storageName)
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
  } catch (err) {
    console.error('[storage] Failed to delete file:', storageName, err.message)
  }
}

module.exports = { UPLOADS_DIR, ensureUploadsDir, getStorageUrl, deleteStoredFile }
