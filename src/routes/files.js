const path   = require('path')
const { json }           = require('../utils/response')
const { requireRole }    = require('../middleware/requireRole')
const { parseMultipart } = require('../utils/parseMultipart')
const { UPLOADS_DIR, getStorageUrl, deleteStoredFile } = require('../services/storageService')
const prisma             = require('../repositories/prisma')

const ALLOWED_TYPES = new Set(['PDF', 'DWG', 'DXF', 'STEP', 'IMAGE', 'OTHER'])
const MIME_TO_TYPE  = {
  'application/pdf':           'PDF',
  'image/jpeg':                'IMAGE',
  'image/png':                 'IMAGE',
  'image/gif':                 'IMAGE',
  'image/webp':                'IMAGE',
  'application/vnd.ms-excel':  'OTHER',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'OTHER',
  'application/msword':        'OTHER',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'OTHER',
}
const EXT_TO_TYPE = {
  '.pdf': 'PDF', '.dwg': 'DWG', '.dxf': 'DXF',
  '.step': 'STEP', '.stp': 'STEP',
  '.jpg': 'IMAGE', '.jpeg': 'IMAGE', '.png': 'IMAGE', '.gif': 'IMAGE', '.webp': 'IMAGE',
  '.xlsx': 'OTHER', '.xls': 'OTHER', '.docx': 'OTHER', '.doc': 'OTHER',
}

function detectFileType(mimeType, originalName) {
  const fromMime = MIME_TO_TYPE[mimeType?.toLowerCase()]
  if (fromMime) return fromMime
  const ext = path.extname(originalName || '').toLowerCase()
  return EXT_TO_TYPE[ext] || 'OTHER'
}

const canUpload = requireRole('ADMIN', 'MANAGER', 'ENGINEER')
const adminOnly = requireRole('ADMIN')

module.exports = [
  // Upload a file and attach to an order
  { method: 'POST', pathname: '/api/orders/:orderId/files', handler: async (req, res, params) => {
    if (!canUpload(req, res)) return
    try {
      const { orderId } = params
      const { context } = req

      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, companyId: true } })
      if (!order) return json(res, { error: 'Order not found' }, 404)

      const { fields, file } = await parseMultipart(req, UPLOADS_DIR)
      if (!file) return json(res, { error: 'No file provided' }, 400)

      const fileType = detectFileType(file.mimeType, file.originalName)
      const title    = fields.title || file.originalName

      const managed = await prisma.managedFile.create({
        data: {
          companyId:   order.companyId,
          fileType,
          title,
          description: fields.description || null,
          versions: {
            create: {
              versionNumber: 1,
              originalName:  file.originalName,
              storagePath:   file.storageName,
              storageUrl:    getStorageUrl(file.storageName),
              mimeType:      file.mimeType || 'application/octet-stream',
              sizeBytes:     BigInt(file.sizeBytes),
              uploadedById:  context?.userId || null,
              changeNotes:   fields.changeNotes || null,
            },
          },
          orders: {
            create: { orderId },
          },
        },
        include: { versions: true },
      })

      json(res, managed, 201)
    } catch (err) {
      console.error('[files] upload error:', err.message)
      json(res, { error: err.message }, err.status || 500)
    }
  }},

  // List files attached to an order
  { method: 'GET', pathname: '/api/orders/:orderId/files', handler: async (req, res, params) => {
    try {
      const orderFiles = await prisma.orderFile.findMany({
        where: { orderId: params.orderId },
        include: {
          file: {
            include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
          },
        },
        orderBy: { attachedAt: 'desc' },
      })

      const result = orderFiles
        .filter(of => of.file && !of.file.deletedAt)
        .map(of => ({
          id:          of.file.id,
          title:       of.file.title,
          description: of.file.description,
          fileType:    of.file.fileType,
          attachedAt:  of.attachedAt,
          version:     of.file.versions[0] ?? null,
        }))

      json(res, result)
    } catch (err) {
      json(res, { error: err.message }, 500)
    }
  }},

  // Soft-delete a file (ADMIN only)
  { method: 'DELETE', pathname: '/api/files/:fileId', handler: async (req, res, params) => {
    if (!adminOnly(req, res)) return
    try {
      const file = await prisma.managedFile.findUnique({
        where:   { id: params.fileId },
        include: { versions: true },
      })
      if (!file) return json(res, { error: 'File not found' }, 404)
      if (file.deletedAt) return json(res, { error: 'Already deleted' }, 400)

      await prisma.managedFile.update({
        where: { id: params.fileId },
        data:  { deletedAt: new Date() },
      })

      json(res, { ok: true })
    } catch (err) {
      json(res, { error: err.message }, 500)
    }
  }},
]
