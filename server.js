const http = require('http')
const { matchRoute } = require('./src/utils/router')
const { json }       = require('./src/utils/response')

const routes = [
  ...require('./src/routes/categories'),
  ...require('./src/routes/materials'),
  ...require('./src/routes/orders'),
  ...require('./src/routes/assemblies'),
  ...require('./src/routes/parts'),
  ...require('./src/routes/revisions'),
  ...require('./src/routes/templates'),
  { method: 'GET', pathname: '/api/health', handler: async (req, res) => {
    json(res, { status: 'ok', db: 'connected', version: '1.0.0' })
  }},
]

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end(); return
  }

  const match = matchRoute(routes, req.method, req.url)
  if (match) {
    try {
      const [, query] = req.url.split('?')
      await match.handler(req, res, match.params, query)
    } catch (err) {
      console.error(err)
      json(res, { error: err.message }, 500)
    }
  } else {
    json(res, { error: 'Not found' }, 404)
  }
})

server.listen(3000, () => console.log('МеталлПро ERP API запущен на порту 3000'))
