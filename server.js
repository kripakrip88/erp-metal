require('dotenv').config()

const http = require('http')
const fs   = require('fs')
const path = require('path')
const { matchRoute }        = require('./src/utils/router')
const { json }              = require('./src/utils/response')
const { authenticate }      = require('./src/middleware/authenticate')
const { startOutboxWorker } = require('./src/workers/outboxWorker')
const { ensureUploadsDir }  = require('./src/services/storageService')

const PUBLIC_PATHS = new Set(['/api/health', '/api/ai-health', '/api/auth/login'])

// ── AI Polygon Proxy ──────────────────────────────────────────────────────────
// Порт 4000 закрыт файрволом снаружи. Браузер не может достучаться напрямую.
// Все запросы /api/email-copilot/* (кроме нативного log-reply) проксируются
// через этот сервер на localhost:4000.
const AI_POLYGON_HOST = process.env.AI_POLYGON_HOST || 'localhost'
const AI_POLYGON_PORT = parseInt(process.env.AI_POLYGON_PORT || '4000', 10)

// Пути, которые обрабатываются нативно в erp-metal (не проксируем)
const NATIVE_EMAIL_PATHS = new Set(['/api/email-copilot/log-reply'])

function proxyToAI(req, res) {
  const chunks = []
  req.on('data', chunk => chunks.push(chunk))
  req.on('end', () => {
    const bodyBuf = Buffer.concat(chunks)
    const headers = Object.assign({}, req.headers, {
      host: AI_POLYGON_HOST + ':' + AI_POLYGON_PORT,
    })
    delete headers['authorization']   // erp-metal JWT не нужен AI-полигону
    if (bodyBuf.length > 0) headers['content-length'] = bodyBuf.length
    else delete headers['content-length']

    const proxyReq = http.request(
      { hostname: AI_POLYGON_HOST, port: AI_POLYGON_PORT, path: req.url, method: req.method, headers },
      (proxyRes) => {
        // 401 от AI Polygon — его внутренняя ошибка, не ERP-авторизация.
        // Меняем на 503 чтобы ERP.authFetch не выбрасывал пользователя из сессии.
        const statusCode = proxyRes.statusCode === 401 ? 503 : proxyRes.statusCode
        const fwdHeaders  = Object.assign({}, proxyRes.headers)
        res.writeHead(statusCode, fwdHeaders)
        proxyRes.pipe(res)
      }
    )
    proxyReq.on('error', () => {
      if (!res.headersSent)
        json(res, { error: 'AI-сервис недоступен', detail: `${AI_POLYGON_HOST}:${AI_POLYGON_PORT}` }, 503)
    })
    if (bodyBuf.length > 0) proxyReq.write(bodyBuf)
    proxyReq.end()
  })
  req.on('error', () => { if (!res.headersSent) json(res, { error: 'request error' }, 400) })
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
}

const routes = [
  ...require('./src/routes/auth'),
  ...require('./src/routes/categories'),
  ...require('./src/routes/materials'),
  ...require('./src/routes/orders'),
  ...require('./src/routes/assemblies'),
  ...require('./src/routes/parts'),
  ...require('./src/routes/revisions'),
  ...require('./src/routes/coatingMaterials'),
  ...require('./src/routes/coatings'),
  ...require('./src/routes/assemblyRevisions'),
  ...require('./src/routes/procurement'),
  ...require('./src/routes/inventory'),
  ...require('./src/routes/templates'),
  ...require('./src/routes/customers'),
  ...require('./src/routes/files'),
  ...require('./src/routes/ordersFromEmail'),
  ...require('./src/routes/emailCopilot'),
  { method: 'GET', pathname: '/api/health', handler: async (_req, res) => {
    json(res, { status: 'ok', db: 'connected', version: '1.0.0' })
  }},
  // Диагностика AI Polygon — публичный endpoint
  { method: 'GET', pathname: '/api/ai-health', handler: async (_req, res) => {
    const https = require('https')
    function probe(hostname, port, path, method = 'GET', body = null, useHttps = false) {
      return new Promise((resolve) => {
        const lib = useHttps ? https : http
        const opts = { hostname, port, path, method, timeout: 5000, headers: {}, rejectUnauthorized: false }
        if (body) { opts.headers['content-type'] = 'application/json'; opts.headers['content-length'] = Buffer.byteLength(body) }
        const r = lib.request(opts, (pr) => {
          const chunks = []
          pr.on('data', c => chunks.push(c))
          pr.on('end', () => resolve({ status: pr.statusCode, body: Buffer.concat(chunks).toString().slice(0, 300) }))
        })
        r.on('timeout', () => { r.destroy(); resolve({ status: 0, body: 'timeout' }) })
        r.on('error', (e) => resolve({ status: 0, body: e.message }))
        if (body) r.write(body)
        r.end()
      })
    }
    const [locInbox, apiInbox] = await Promise.all([
      probe(AI_POLYGON_HOST, AI_POLYGON_PORT, '/api/email-copilot/inbox?limit=1'),
      probe('api.erppark.ru', 443, '/api/email-copilot/inbox?limit=1', 'GET', null, true),
    ])
    json(res, {
      localhost_4000: { status: locInbox.status, body: locInbox.body },
      api_erppark_ru:  { status: apiInbox.status, body: apiInbox.body },
    })
  }},
]

const PUBLIC_DIR = path.join(__dirname, 'public')

function serveStatic(req, res) {
  const [pathname] = req.url.split('?')
  const target = pathname === '/' ? '/login.html' : pathname
  const filePath = path.join(PUBLIC_DIR, target)

  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return true }

  const ext = path.extname(filePath)
  if (!MIME[ext] && ext !== '') return false

  try {
    const data = fs.readFileSync(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600',
      'Pragma': 'no-cache',
      'Expires': '0',
    })
    res.end(data)
    return true
  } catch {
    return false
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }

  const [pathname] = req.url.split('?')

  // Serve static files first (no auth required for HTML/JS/CSS)
  if (req.method === 'GET' && !pathname.startsWith('/api/')) {
    // Serve uploaded files from /uploads/ — auth not required (URLs are UUID-keyed)
    if (pathname.startsWith('/uploads/')) {
      const UPLOADS_DIR = require('./src/services/storageService').UPLOADS_DIR
      const filePath = path.join(UPLOADS_DIR, pathname.slice('/uploads/'.length))
      if (!filePath.startsWith(UPLOADS_DIR)) { res.writeHead(403); res.end(); return }
      try {
        const data = fs.readFileSync(filePath)
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, max-age=86400' })
        res.end(data)
        return
      } catch { res.writeHead(404); res.end(); return }
    }
    if (serveStatic(req, res)) return
  }

  if (!PUBLIC_PATHS.has(pathname) && !authenticate(req, res)) return

  // Proxy /api/email-copilot/* → AI Polygon localhost:4000
  // Нативные пути (log-reply) пропускаем дальше — они в routes
  if (pathname.startsWith('/api/email-copilot/') && !NATIVE_EMAIL_PATHS.has(pathname)) {
    proxyToAI(req, res)
    return
  }

  if (pathname.startsWith('/api/normalization/')) {
    proxyToAI(req, res)
    return
  }

  const match = matchRoute(routes, req.method, req.url)
  if (match) {
    try {
      const [, query] = req.url.split('?')
      await match.handler(req, res, match.params, query)
    } catch (err) {
      console.error(err)
      json(res, { error: err.message }, err.status || 500)
    }
  } else {
    json(res, { error: 'Not found' }, 404)
  }
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`МеталлПро ERP запущен на порту ${PORT}`)
  ensureUploadsDir()
  startOutboxWorker()
})