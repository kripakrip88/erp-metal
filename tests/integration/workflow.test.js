'use strict'
// Integration test: полный цикл от письма заказчика до расчёта КП.
// Проверяет корректность кнопок (API-эндпоинтов) и логическую последовательность работы.
//
// Workflow:
//   1. Получение письма → создание заказа (DRAFT)
//   2. Добавление сборки (узла металлоконструкции)
//   3. Добавление детали (позиции спецификации)
//   4. Создание расчёта КП (QuoteRevision) — snapshot весов и стоимостей
//   5. Проверка автоактивации ревизии КП на заказе
//   6. Создание повторной ревизии → старая отмечается SUPERSEDED
//   7. Проверка защиты: нельзя создать КП без сборок

// ─── Setup: inject mock DB before any service module is loaded ────────────────
process.env.JWT_SECRET = 'test-secret-for-workflow-tests'

const path = require('node:path')
const PRISMA_KEY = path.resolve(__dirname, '../../src/repositories/prisma.js')

const { mockPrisma, COMPANY, USER, MOCK_MATERIAL, db, resetDb } = require('./mock-db')

// Inject the mock into Node's require cache before requiring anything that uses prisma
require.cache[PRISMA_KEY] = {
  id:       PRISMA_KEY,
  filename: PRISMA_KEY,
  loaded:   true,
  exports:  mockPrisma,
  children: [],
  paths:    [],
}

// ─── Now safe to load server modules ─────────────────────────────────────────
const http   = require('node:http')
const { test, describe, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')

const { matchRoute }   = require('../../src/utils/router')
const { json }         = require('../../src/utils/response')
const { authenticate } = require('../../src/middleware/authenticate')
const { signToken }    = require('../../src/utils/auth')

const PUBLIC_PATHS = new Set(['/api/health', '/api/auth/login'])

const routes = [
  ...require('../../src/routes/auth'),
  ...require('../../src/routes/orders'),
  ...require('../../src/routes/assemblies'),
  ...require('../../src/routes/parts'),
  ...require('../../src/routes/revisions'),
  ...require('../../src/routes/assemblyRevisions'),
  { method: 'GET', pathname: '/api/health', handler: async (_req, res) =>
    json(res, { status: 'ok' }) },
]

// ─── Test HTTP server ─────────────────────────────────────────────────────────
let server
let port
let authToken

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin',  '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
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
          json(res, { error: err.message }, err.status || 500)
        }
      } else {
        json(res, { error: 'Not found' }, 404)
      }
    })
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port
      resolve()
    })
  })
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
async function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token || authToken}`,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }
    const httpReq = http.request(options, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    httpReq.on('error', reject)
    if (payload) httpReq.write(payload)
    httpReq.end()
  })
}

// ─── Test lifecycle ───────────────────────────────────────────────────────────
before(async () => {
  await startServer()
  // Issue a valid JWT directly (simulates successful login)
  authToken = signToken({ userId: USER.id, role: USER.role, companyId: COMPANY.id })
})

after(() => {
  server?.close()
})

beforeEach(() => {
  resetDb()
})

// ─── ТЕСТ 1: Сервер отвечает ──────────────────────────────────────────────────
test('GET /api/health возвращает 200', async () => {
  const r = await req('GET', '/api/health')
  assert.equal(r.status, 200)
  assert.equal(r.body.status, 'ok')
})

// ─── ТЕСТ 2: Создание заказа (эмулирует "получено письмо от заказчика") ────────
describe('Шаг 1 — Создание заказа (письмо от заказчика)', () => {
  test('POST /api/orders создаёт заказ со статусом DRAFT', async () => {
    const r = await req('POST', '/api/orders', {
      customerName: 'ООО МеталлСтрой',
      title:        'Забор металлический ул.Ленина 5',
      orderNumber:  'RFQ-2024-001',
      description:  'Запрос по электронной почте 15.01.2024',
    })
    assert.equal(r.status, 201, `Ожидали 201, получили ${r.status}: ${JSON.stringify(r.body)}`)
    assert.ok(r.body.id,            'Заказ должен иметь id')
    assert.equal(r.body.status, 'DRAFT', 'Новый заказ должен быть в статусе DRAFT')
    assert.equal(r.body.customerName, 'ООО МеталлСтрой')
    assert.equal(r.body.title, 'Забор металлический ул.Ленина 5')
  })

  test('POST /api/orders без customerName возвращает 400', async () => {
    const r = await req('POST', '/api/orders', { title: 'Забор' })
    assert.equal(r.status, 400)
    assert.ok(r.body.error, 'Должно быть сообщение об ошибке')
  })

  test('POST /api/orders без title возвращает 400', async () => {
    const r = await req('POST', '/api/orders', { customerName: 'ООО Тест' })
    assert.equal(r.status, 400)
  })

  test('GET /api/orders возвращает список заказов', async () => {
    // Создаём заказ
    await req('POST', '/api/orders', { customerName: 'ООО Тест', title: 'Проект А' })
    const r = await req('GET', '/api/orders')
    assert.equal(r.status, 200)
    assert.ok(Array.isArray(r.body), 'Должен вернуть массив')
    assert.equal(r.body.length, 1)
  })

  test('GET /api/orders/:id возвращает конкретный заказ', async () => {
    const create = await req('POST', '/api/orders', { customerName: 'ООО Тест', title: 'Проект Б' })
    const orderId = create.body.id
    const r = await req('GET', `/api/orders/${orderId}`)
    assert.equal(r.status, 200)
    assert.equal(r.body.id, orderId)
  })

  test('GET /api/orders/:id несуществующий ID возвращает 404', async () => {
    const r = await req('GET', '/api/orders/00000000-0000-0000-0000-000000000000')
    assert.equal(r.status, 404)
  })

  test('Запрос без авторизации возвращает 401', async () => {
    const r = await req('GET', '/api/orders', null, 'invalid-token')
    assert.equal(r.status, 401)
  })
})

// ─── ТЕСТ 3: Добавление сборки ────────────────────────────────────────────────
describe('Шаг 2 — Добавление сборки к заказу', () => {
  async function createOrder() {
    const r = await req('POST', '/api/orders', { customerName: 'ООО Тест', title: 'Проект' })
    return r.body
  }

  test('POST /api/orders/:id/assemblies создаёт сборку', async () => {
    const order = await createOrder()
    const r = await req('POST', `/api/orders/${order.id}/assemblies`, {
      name: 'Секция забора 2м',
      qty:  10,
      description: 'Пролётная секция',
    })
    assert.equal(r.status, 201, `Ожидали 201: ${JSON.stringify(r.body)}`)
    assert.ok(r.body.id,    'Сборка должна иметь id')
    assert.equal(r.body.name, 'Секция забора 2м')
    assert.equal(r.body.qty,  10)
  })

  test('POST создаёт несколько сборок для одного заказа', async () => {
    const order = await createOrder()
    await req('POST', `/api/orders/${order.id}/assemblies`, { name: 'Секция 1', qty: 5 })
    await req('POST', `/api/orders/${order.id}/assemblies`, { name: 'Столб', qty: 12 })
    // Оба должны создаться
    assert.equal(db.assemblies.size, 2)
  })
})

// ─── ТЕСТ 4: Добавление детали в сборку ──────────────────────────────────────
describe('Шаг 3 — Добавление детали (позиция спецификации)', () => {
  async function createOrderWithAssembly() {
    const o = await req('POST', '/api/orders', { customerName: 'ООО Тест', title: 'Проект' })
    const a = await req('POST', `/api/orders/${o.body.id}/assemblies`, { name: 'Рама', qty: 1 })
    return { order: o.body, assembly: a.body }
  }

  test('POST /api/orders/:orderId/assemblies/:asmId/parts создаёт деталь', async () => {
    const { order, assembly } = await createOrderWithAssembly()
    const r = await req('POST', `/api/orders/${order.id}/assemblies/${assembly.id}/parts`, {
      materialDefinitionId: MOCK_MATERIAL.id,
      measurementType:      'AREA',
      sheetWidth:           2000,
      sheetHeight:          1000,
      quantity:             3,
    })
    assert.equal(r.status, 201, `Ожидали 201: ${JSON.stringify(r.body)}`)
    assert.ok(r.body.id)
    assert.equal(r.body.assemblyId, assembly.id)
    assert.equal(r.body.quantity, 3)
  })
})

// ─── ТЕСТ 5: Создание расчёта КП (ключевой шаг) ───────────────────────────────
describe('Шаг 4 — Создание расчёта КП (коммерческое предложение)', () => {
  async function createOrderWithPart() {
    const o = await req('POST', '/api/orders', { customerName: 'ООО МеталлСтрой', title: 'Ограждение' })
    const a = await req('POST', `/api/orders/${o.body.id}/assemblies`, { name: 'Секция', qty: 5 })
    await req('POST', `/api/orders/${o.body.id}/assemblies/${a.body.id}/parts`, {
      materialDefinitionId: MOCK_MATERIAL.id,
      measurementType:      'AREA',
      sheetWidth:           1000,
      sheetHeight:          500,
      quantity:             2,
    })
    return o.body.id
  }

  test('POST /api/orders/:id/revisions создаёт ревизию КП', async () => {
    const orderId = await createOrderWithPart()
    const r = await req('POST', `/api/orders/${orderId}/revisions`, {
      notes: 'Первый расчёт по письму от 15.01.2024',
    })
    assert.equal(r.status, 201, `Ожидали 201: ${JSON.stringify(r.body)}`)
    assert.ok(r.body.id,             'Ревизия должна иметь id')
    assert.equal(r.body.orderId, orderId)
    assert.equal(r.body.revisionNumber, 1, 'Первая ревизия должна иметь номер 1')
    assert.equal(r.body.status, 'DRAFT',  'КП создаётся в статусе DRAFT')
    assert.ok(r.body.calculation,         'КП должен содержать расчёт')
    assert.ok(r.body.calculation.totalWeightKg >= 0, 'Общий вес должен быть >= 0')
  })

  test('КП содержит расчёт весов и стоимостей', async () => {
    const orderId = await createOrderWithPart()
    const r = await req('POST', `/api/orders/${orderId}/revisions`, {})
    const calc = r.body.calculation
    assert.ok(calc,                'Расчёт должен присутствовать')
    assert.ok('totalWeightKg' in calc,   'totalWeightKg')
    assert.ok('totalMaterialCost' in calc, 'totalMaterialCost')
    assert.ok('totalPaintM2' in calc,    'totalPaintM2')
    // AREA sheet 1000×500mm, qty 2, assembly qty 5 = 10 sheets total
    // Weight: 1m × 0.5m × 78.5 kg/m² × 10 = 392.5 kg
    assert.equal(calc.totalWeightKg, 392.5, 'Вес 10 листов 1000×500 из Ст3-10')
  })

  test('КП автоматически становится активным на заказе', async () => {
    const orderId = await createOrderWithPart()
    const rev = await req('POST', `/api/orders/${orderId}/revisions`, {})
    const order = db.orders.get(orderId)
    assert.equal(order.activeQuoteRevisionId, rev.body.id,
      'activeQuoteRevisionId должен указывать на только что созданную ревизию')
  })

  test('Список ревизий возвращает созданный КП', async () => {
    const orderId = await createOrderWithPart()
    await req('POST', `/api/orders/${orderId}/revisions`, {})
    const r = await req('GET', `/api/orders/${orderId}/revisions`)
    assert.equal(r.status, 200)
    assert.ok(Array.isArray(r.body))
    assert.equal(r.body.length, 1)
  })

  test('Повторный запрос создаёт ревизию с номером 2', async () => {
    const orderId = await createOrderWithPart()
    await req('POST', `/api/orders/${orderId}/revisions`, {})
    const r2 = await req('POST', `/api/orders/${orderId}/revisions`, { notes: 'Пересчёт' })
    assert.equal(r2.body.revisionNumber, 2)
  })

  test('Нельзя создать КП для заказа без сборок', async () => {
    const o = await req('POST', '/api/orders', { customerName: 'ООО Тест', title: 'Пустой заказ' })
    const r = await req('POST', `/api/orders/${o.body.id}/revisions`, {})
    assert.equal(r.status, 500)
    assert.ok(r.body.error.includes('no assemblies') || r.body.error.includes('нет'),
      `Ожидали ошибку об отсутствии сборок, получили: ${r.body.error}`)
  })
})

// ─── ТЕСТ 6: Логика ревизий — активация и вытеснение ─────────────────────────
describe('Шаг 5 — Управление ревизиями КП (кнопка "Активировать")', () => {
  async function createOrderWith2Revisions() {
    const o = await req('POST', '/api/orders', { customerName: 'ООО Тест', title: 'Проект' })
    const a = await req('POST', `/api/orders/${o.body.id}/assemblies`, { name: 'Узел 1', qty: 1 })
    await req('POST', `/api/orders/${o.body.id}/assemblies/${a.body.id}/parts`, {
      materialDefinitionId: MOCK_MATERIAL.id,
      measurementType: 'AREA', sheetWidth: 500, sheetHeight: 500, quantity: 1,
    })
    const rev1 = await req('POST', `/api/orders/${o.body.id}/revisions`, { notes: 'Первый расчёт' })
    const rev2 = await req('POST', `/api/orders/${o.body.id}/revisions`, { notes: 'Пересчёт цен' })
    return { orderId: o.body.id, rev1: rev1.body, rev2: rev2.body }
  }

  test('После двух ревизий активной становится последняя', async () => {
    const { orderId, rev2 } = await createOrderWith2Revisions()
    const order = db.orders.get(orderId)
    assert.equal(order.activeQuoteRevisionId, rev2.id,
      'Активной должна быть вторая (последняя) ревизия')
  })

  test('PATCH .../activate делает ревизию активной', async () => {
    const { orderId, rev1, rev2 } = await createOrderWith2Revisions()
    // Возвращаем активность первой ревизии
    const r = await req('PATCH', `/api/orders/${orderId}/revisions/${rev1.id}/activate`)
    assert.equal(r.status, 200, `Активация: ${JSON.stringify(r.body)}`)
    const order = db.orders.get(orderId)
    assert.equal(order.activeQuoteRevisionId, rev1.id, 'Активной должна стать первая ревизия')
  })

  test('Нельзя активировать ревизию из другого заказа', async () => {
    const { orderId } = await createOrderWith2Revisions()
    // Создаём другой заказ и ревизию
    const o2 = await req('POST', '/api/orders', { customerName: 'ООО Другой', title: 'Другой проект' })
    const a2 = await req('POST', `/api/orders/${o2.body.id}/assemblies`, { name: 'Узел', qty: 1 })
    await req('POST', `/api/orders/${o2.body.id}/assemblies/${a2.body.id}/parts`, {
      materialDefinitionId: MOCK_MATERIAL.id,
      measurementType: 'AREA', sheetWidth: 500, sheetHeight: 500, quantity: 1,
    })
    const rev3 = await req('POST', `/api/orders/${o2.body.id}/revisions`, {})
    // Пробуем активировать ревизию второго заказа на первом заказе
    const r = await req('PATCH', `/api/orders/${orderId}/revisions/${rev3.body.id}/activate`)
    assert.equal(r.status, 500, 'Должна быть ошибка — ревизия не принадлежит заказу')
  })
})

// ─── ТЕСТ 7: Создание ревизии сборки и заморозка ──────────────────────────────
describe('Шаг 6 — Инженерная ревизия сборки (кнопка "Заморозить")', () => {
  async function createOrderWithAssembly() {
    const o = await req('POST', '/api/orders', { customerName: 'Тест', title: 'Проект' })
    const a = await req('POST', `/api/orders/${o.body.id}/assemblies`, { name: 'Рама', qty: 1 })
    return { orderId: o.body.id, assembly: a.body }
  }

  test('POST /api/assemblies/:id/assembly-revisions создаёт черновик ревизии', async () => {
    const { assembly } = await createOrderWithAssembly()
    const r = await req('POST', `/api/assemblies/${assembly.id}/assembly-revisions`, {
      notes: 'Первая версия конструкции',
    })
    assert.equal(r.status, 201, `Ожидали 201: ${JSON.stringify(r.body)}`)
    assert.ok(r.body.id)
    assert.equal(r.body.status, 'DRAFT')
    assert.equal(r.body.revisionNumber, 1)
  })

  test('Нельзя создать вторую черновую ревизию если есть активный черновик', async () => {
    const { assembly } = await createOrderWithAssembly()
    await req('POST', `/api/assemblies/${assembly.id}/assembly-revisions`, {})
    const r2 = await req('POST', `/api/assemblies/${assembly.id}/assembly-revisions`, {})
    assert.equal(r2.status, 400, 'Должна быть ошибка о существующем черновике')
    assert.ok(r2.body.error.includes('DRAFT'), `Ошибка: ${r2.body.error}`)
  })

  test('Нельзя заморозить пустую ревизию (без покрытий)', async () => {
    const { assembly } = await createOrderWithAssembly()
    const draft = await req('POST', `/api/assemblies/${assembly.id}/assembly-revisions`, {})
    const r = await req('POST', `/api/assembly-revisions/${draft.body.id}/freeze`, {
      freezeReason: 'Утверждено главным инженером',
    })
    assert.equal(r.status, 400)
    assert.ok(r.body.error.includes('empty') || r.body.error.includes('coatings') ||
              r.body.error.includes('Cannot'),
      `Ожидали ошибку о пустой ревизии, получили: ${r.body.error}`)
  })
})

// ─── ТЕСТ 8: Полный workflow от письма до КП ─────────────────────────────────
describe('Полный цикл: письмо заказчика → расчёт КП', () => {
  test('Выполняет все шаги workflow без ошибок', async () => {
    // Шаг 1: Получено письмо → создаём заказ
    const orderResp = await req('POST', '/api/orders', {
      customerName: 'ООО МеталлСтрой',
      title:        'Ограждение территории завода',
      orderNumber:  'RFQ-2024-042',
      description:  'Запрос по email от 15.01.2024, прикреплён чертёж DWG',
    })
    assert.equal(orderResp.status, 201)
    const orderId = orderResp.body.id
    assert.equal(orderResp.body.status, 'DRAFT', 'Статус: DRAFT')

    // Шаг 2: Добавляем сборки (узлы конструкции)
    const asm1Resp = await req('POST', `/api/orders/${orderId}/assemblies`, {
      name: 'Пролётная секция 3м', qty: 20, description: 'Секция из трубы 60×40',
    })
    assert.equal(asm1Resp.status, 201)
    const asmId1 = asm1Resp.body.id

    const asm2Resp = await req('POST', `/api/orders/${orderId}/assemblies`, {
      name: 'Столб 2.5м', qty: 21,
    })
    assert.equal(asm2Resp.status, 201)

    // Шаг 3: Добавляем детали (позиции спецификации)
    const partResp = await req('POST', `/api/orders/${orderId}/assemblies/${asmId1}/parts`, {
      materialDefinitionId: MOCK_MATERIAL.id,
      measurementType: 'AREA',
      sheetWidth:  3000,
      sheetHeight: 1800,
      quantity:    1,
    })
    assert.equal(partResp.status, 201, `Деталь создана: ${JSON.stringify(partResp.body)}`)

    // Шаг 4: Создаём расчёт КП
    const kpResp = await req('POST', `/api/orders/${orderId}/revisions`, {
      notes: 'Предварительный расчёт по запросу RFQ-2024-042',
    })
    assert.equal(kpResp.status, 201, `КП создан: ${JSON.stringify(kpResp.body)}`)

    const kp = kpResp.body
    assert.equal(kp.orderId, orderId,           'КП привязан к заказу')
    assert.equal(kp.revisionNumber, 1,          'Первая ревизия КП')
    assert.equal(kp.status, 'DRAFT',            'Статус КП: DRAFT')
    assert.ok(kp.calculation,                   'Расчёт присутствует')

    // Проверяем расчёт: 20 секций × 1 лист 3000×1800 из Ст3-10
    // Площадь: 3м × 1.8м = 5.4 м² каждый лист
    // Вес: 5.4 × 78.5 = 423.9 кг × 20 = 8478 кг
    assert.equal(kp.calculation.totalWeightKg, 8478, 'Расчёт веса для 20 секций')

    // Шаг 5: КП автоматически активировано
    const order = db.orders.get(orderId)
    assert.equal(order.activeQuoteRevisionId, kp.id, 'КП автоматически активирован')

    // Шаг 6: Просматриваем список ревизий
    const listResp = await req('GET', `/api/orders/${orderId}/revisions`)
    assert.equal(listResp.status, 200)
    assert.equal(listResp.body.length, 1, 'Одна ревизия в журнале')

    // Шаг 7: Создаём новую ревизию (пересчёт)
    const kp2Resp = await req('POST', `/api/orders/${orderId}/revisions`, {
      notes: 'Пересчёт с учётом коэффициента наценки 15%',
    })
    assert.equal(kp2Resp.status, 201)
    assert.equal(kp2Resp.body.revisionNumber, 2, 'Вторая ревизия')

    // Старая ревизия должна быть помечена SUPERSEDED
    const oldQr = db.quoteRevisions.get(kp.id)
    assert.equal(oldQr.status, 'SUPERSEDED', 'Первая ревизия отмечена SUPERSEDED')

    // Новая ревизия теперь активная
    const updatedOrder = db.orders.get(orderId)
    assert.equal(updatedOrder.activeQuoteRevisionId, kp2Resp.body.id,
      'Активна вторая ревизия')

    console.log('  ✓ Полный workflow выполнен успешно')
    console.log(`  ✓ Заказ: ${orderId}`)
    console.log(`  ✓ Вес конструкции: ${kp.calculation.totalWeightKg} кг`)
    console.log(`  ✓ Стоимость материалов: ${kp.calculation.totalMaterialCost} руб.`)
    console.log(`  ✓ Ревизий КП: ${listResp.body.length + 1}`)
  })
})
