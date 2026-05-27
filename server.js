require('dotenv').config()

const http = require('http')
const fs   = require('fs')
const path = require('path')
const { matchRoute }   = require('./src/utils/router')
const { json }         = require('./src/utils/response')
const { authenticate } = require('./src/middleware/authenticate')

const PUBLIC_PATHS = new Set(['/api/health', '/api/auth/login'])

// ── AI Polygon Proxy ───────────────────────────────────────────────────────────
const AI_POLYGON_HOST = process.env.AI_POLYGON_HOST || 'localhost'
const AI_POLYGON_PORT = parseInt(process.env.AI_POLYGON_PORT || '4000', 10)

function proxyToAI(req, res) {
  const chunks = []
  req.on('data', chunk => chunks.push(chunk))
  req.on('end', () => {
    const bodyBuf = Buffer.concat(chunks)
    const headers = Object.assign({}, req.headers, { host: AI_POLYGON_HOST + ':' + AI_POLYGON_PORT })
    delete headers['authorization'] // не пробрасываем erp-metal JWT в AI-сервис
    if (bodyBuf.length > 0) headers['content-length'] = bodyBuf.length
    else delete headers['content-length']

    const options = { hostname: AI_POLYGON_HOST, port: AI_POLYGON_PORT, path: req.url, method: req.method, headers }
    const proxyReq = http.request(options, (proxyRes) => {
      const resHeaders = Object.assign({}, proxyRes.headers, {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      res.writeHead(proxyRes.statusCode, resHeaders)
      proxyRes.pipe(res)
    })
    proxyReq.on('error', () => {
      if (!res.headersSent) json(res, { error: 'AI-сервис недоступен', host: AI_POLYGON_HOST, port: AI_POLYGON_PORT }, 503)
    })
    if (bodyBuf.length > 0) proxyReq.write(bodyBuf)
    proxyReq.end()
  })
  req.on('error', () => { if (!res.headersSent) json(res, { error: 'Request error' }, 400) })
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
  { method: 'GET', pathname: '/api/health', handler: async (_req, res) => {
    json(res, { status: 'ok', db: 'connected', version: '1.0.0' })
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
    if (serveStatic(req, res)) return
  }

  // Proxy /api/email-copilot/* → AI Polygon (порт 4000 по умолчанию)
  if (pathname.startsWith('/api/email-copilot/') || pathname === '/api/email-copilot') {
    if (!authenticate(req, res)) return
    proxyToAI(req, res)
    return
  }

  if (!PUBLIC_PATHS.has(pathname) && !authenticate(req, res)) return

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
server.listen(PORT, () => console.log(`МеталлПро ERP запущен на порту ${PORT}`))