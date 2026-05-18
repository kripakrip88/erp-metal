require('dotenv').config()

const http = require('http')
const { matchRoute }   = require('./src/utils/router')
const { json }         = require('./src/utils/response')
const { authenticate } = require('./src/middleware/authenticate')

const PUBLIC_PATHS = new Set(['/api/health', '/api/auth/login'])

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
  { method: 'GET', pathname: '/api/health', handler: async (req, res) => {
    json(res, { status: 'ok', db: 'connected', version: '1.0.0' })
  }},
]

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }

  const [pathname] = req.url.split('?')
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
server.listen(PORT, () => console.log(`РњРµС‚Р°Р»Р»РџСЂРѕ ERP API Р·Р°РїСѓС‰РµРЅ РЅР° РїРѕСЂС‚Сѓ ${PORT}`))