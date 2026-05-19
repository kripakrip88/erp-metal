'use strict'
// In-memory mock database for integration tests.
// Replaces the Prisma client singleton so tests run without a real PostgreSQL connection.

const { randomUUID } = require('node:crypto')

function uuid() { return randomUUID() }

// ─── In-memory tables ─────────────────────────────────────────────────────────
const COMPANY = { id: 'comp-test-1', name: 'Тестовая Компания', createdAt: new Date() }
const USER    = { id: 'user-test-1', companyId: COMPANY.id, email: 'test@erp.test',
                  firstName: 'Тест', lastName: 'Менеджер', role: 'ADMIN',
                  passwordHash: '$2b$10$testhashtesthashhtest', isActive: true, deletedAt: null }

// Mock material for BOM parts (AREA measurement, 10mm steel sheet)
const MOCK_MATERIAL = {
  id:              'mat-test-001',
  code:            'ST3-10',
  name:            'Лист стальной Ст3 10мм',
  materialType:    'STEEL',
  profileType:     'SHEET',
  steelGrade:      'Ст3',
  geometry: {
    theoreticalWeightPerMeter: null,
    weightPerSquareMeter:      78.5,
    unitWeightKg:              null,
    paintSurfacePerMeter:      null,
  },
  procurementProfiles: [{
    supplierName:  'Северсталь',
    pricePerPiece: null,
    prices: [{
      pricePerTon: 95000,
      validFrom:   new Date('2024-01-01'),
      validTo:     null,
    }],
  }],
}

// ─── Stores ───────────────────────────────────────────────────────────────────
const db = {
  orders:             new Map(),
  assemblies:         new Map(),
  parts:              new Map(),
  assemblyRevisions:  new Map(),
  assemblyCoatings:   new Map(),
  assemblyRevisionCoatingSnapshots: new Map(),
  quoteRevisions:     new Map(),
  auditLogs:          [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pick(obj, keys) {
  const r = {}
  for (const k of keys) if (k in obj || obj[k] !== undefined) r[k] = obj[k]
  return r
}

function applySelect(obj, select) {
  if (!select || !obj) return obj
  const keys = Object.keys(select)
  const r = {}
  for (const k of keys) {
    if (select[k] === true) {
      r[k] = obj[k]
    } else if (typeof select[k] === 'object' && obj[k] !== undefined) {
      // Nested select
      if (Array.isArray(obj[k])) {
        r[k] = obj[k].map(item => applySelect(item, select[k].select || select[k]))
      } else {
        r[k] = applySelect(obj[k], select[k].select || select[k])
      }
    }
  }
  return r
}

// ─── Mock Prisma client ───────────────────────────────────────────────────────
const mockPrisma = {
  $transaction: async (fn) => fn(mockPrisma),

  company: {
    findFirst: async () => COMPANY,
  },

  user: {
    findFirst: async ({ where } = {}) => {
      if (where?.companyId && where.companyId !== COMPANY.id) return null
      return USER
    },
    findUnique: async ({ where }) => {
      if (where?.id === USER.id) return USER
      return null
    },
    update: async ({ where, data }) => {
      // lastLoginAt update during auth
      return { ...USER, ...data }
    },
  },

  order: {
    create: async ({ data }) => {
      const order = {
        id:                    uuid(),
        companyId:             data.companyId,
        createdById:           data.createdById,
        orderNumber:           data.orderNumber,
        customerName:          data.customerName,
        customerId:            data.customerId || null,
        title:                 data.title,
        description:           data.description || null,
        status:                data.status || 'DRAFT',
        mode:                  data.mode || 'STANDARD',
        dueDate:               data.dueDate || null,
        activeQuoteRevisionId: null,
        deletedAt:             null,
        createdAt:             new Date(),
        updatedAt:             new Date(),
        _count:                { assemblies: 0, revisions: 0 },
      }
      db.orders.set(order.id, order)
      return order
    },
    findMany: async ({ where, include } = {}) => {
      let result = Array.from(db.orders.values())
      if (where?.companyId) result = result.filter(o => o.companyId === where.companyId)
      if (where?.deletedAt === null) result = result.filter(o => o.deletedAt === null)
      return result
    },
    findUnique: async ({ where, select, include }) => {
      const order = db.orders.get(where?.id)
      if (!order) return null
      if (select) return applySelect(order, select)
      if (include?.assemblies) {
        const assemblies = Array.from(db.assemblies.values()).filter(a => a.orderId === order.id)
        return { ...order, assemblies }
      }
      return order
    },
    update: async ({ where, data, select }) => {
      const order = db.orders.get(where?.id)
      if (!order) throw Object.assign(new Error('Order not found'), { code: 'P2025' })
      Object.assign(order, data, { updatedAt: new Date() })
      if (select) return applySelect(order, select)
      return order
    },
  },

  assembly: {
    create: async ({ data }) => {
      const asm = {
        id:                  uuid(),
        orderId:             data.orderId,
        name:                data.name,
        description:         data.description || null,
        qty:                 data.qty != null ? parseInt(data.qty) : 1,
        position:            data.position || 0,
        currentRevisionId:   null,
        releasedRevisionId:  null,
        createdAt:           new Date(),
        order: db.orders.get(data.orderId) || null,
      }
      db.assemblies.set(asm.id, asm)
      return asm
    },
    findMany: async ({ where, select, orderBy } = {}) => {
      let result = Array.from(db.assemblies.values())
      if (where?.orderId) result = result.filter(a => a.orderId === where.orderId)
      if (where?.id?.in) result = result.filter(a => where.id.in.includes(a.id))
      // where.releasedRevisionId.not === null means "has a releasedRevisionId"
      if (where?.releasedRevisionId?.not === null) {
        result = result.filter(a => a.releasedRevisionId !== null)
      }
      if (select) return result.map(a => applySelect(a, select))
      return result
    },
    findFirst: async ({ where, select } = {}) => {
      let result = Array.from(db.assemblies.values())
      if (where?.orderId) result = result.filter(a => a.orderId === where.orderId)
      if (where?.releasedRevisionId?.not === null) {
        result = result.filter(a => a.releasedRevisionId !== null)
      }
      const found = result[0] || null
      if (found && select) return applySelect(found, select)
      return found
    },
    findUnique: async ({ where, select }) => {
      const asm = db.assemblies.get(where?.id)
      if (!asm) return null
      // Attach nested order for status checks
      const withOrder = { ...asm, order: db.orders.get(asm.orderId) || { status: 'DRAFT' } }
      if (select) return applySelect(withOrder, select)
      return withOrder
    },
    update: async ({ where, data, select }) => {
      const asm = db.assemblies.get(where?.id)
      if (!asm) throw Object.assign(new Error('Assembly not found'), { code: 'P2025' })
      Object.assign(asm, data)
      if (select) return applySelect(asm, select)
      return asm
    },
    updateMany: async ({ where, data }) => {
      let count = 0
      for (const [, asm] of db.assemblies) {
        const matchId = !where?.id?.in || where.id.in.includes(asm.id)
        const matchOrder = !where?.orderId || asm.orderId === where.orderId
        if (matchId && matchOrder) { Object.assign(asm, data); count++ }
      }
      return { count }
    },
    deleteMany: async ({ where }) => {
      let count = 0
      for (const [id, asm] of db.assemblies) {
        if (where?.id?.in?.includes(id)) { db.assemblies.delete(id); count++ }
      }
      return { count }
    },
  },

  part: {
    create: async ({ data }) => {
      const part = {
        id:                  uuid(),
        assemblyId:          data.assemblyId,
        materialDefinitionId: data.materialDefinitionId,
        name:                data.name || null,
        measurementType:     data.measurementType || 'AREA',
        length:              data.length || null,
        sheetWidth:          data.sheetWidth || null,
        sheetHeight:         data.sheetHeight || null,
        directWeightKg:      data.directWeightKg || null,
        quantity:            data.quantity || 1,
        notes:               data.notes || null,
        position:            data.position || 0,
        partCategory:        data.partCategory || 'MATERIAL',
        bomTemplateCode:     null, bomTemplateId: null, bomTemplateVersion: null,
        bomGroupKey:         null, bomGroupLabel: null, bomDepth: null,
        bomPath:             null, bomSortPath:   null,
        createdAt:           new Date(),
      }
      db.parts.set(part.id, part)
      return part
    },
    findMany: async ({ where, include } = {}) => {
      let result = Array.from(db.parts.values())
      if (where?.assemblyId?.in) result = result.filter(p => where.assemblyId.in.includes(p.assemblyId))
      if (where?.assemblyId && typeof where.assemblyId === 'string') {
        result = result.filter(p => p.assemblyId === where.assemblyId)
      }
      if (include?.materialDefinition) {
        result = result.map(p => ({
          ...p,
          materialDefinition: p.materialDefinitionId === MOCK_MATERIAL.id ? MOCK_MATERIAL : null,
        }))
      }
      return result
    },
    deleteMany: async ({ where }) => {
      let count = 0
      for (const [id, part] of db.parts) {
        if (where?.assemblyId?.in?.includes(part.assemblyId)) { db.parts.delete(id); count++ }
      }
      return { count }
    },
  },

  assemblyRevision: {
    create: async ({ data, include }) => {
      const rev = {
        id:             uuid(),
        assemblyId:     data.assemblyId,
        revisionNumber: data.revisionNumber,
        status:         data.status || 'DRAFT',
        createdByUserId: data.createdByUserId || null,
        notes:           data.notes || null,
        frozenAt:        null,
        frozenByUserId:  null,
        freezeReason:    null,
        totalTheoreticalConsumptionKg: null,
        totalFinalConsumptionKg:       null,
        totalCalculatedCost:           null,
        coatingSnapshots:              [],
        revisionCoatingLinks:          [],
        createdAt:       new Date(),
      }
      db.assemblyRevisions.set(rev.id, rev)
      return rev
    },
    findFirst: async ({ where, select, orderBy } = {}) => {
      let result = Array.from(db.assemblyRevisions.values())
      if (where?.assemblyId) result = result.filter(r => r.assemblyId === where.assemblyId)
      if (where?.status) result = result.filter(r => r.status === where.status)
      if (where?.id?.in) result = result.filter(r => where.id.in.includes(r.id))
      if (orderBy?.revisionNumber === 'desc') result.sort((a, b) => b.revisionNumber - a.revisionNumber)
      const found = result[0] || null
      if (found && select) return applySelect(found, select)
      return found
    },
    findMany: async ({ where, select, include, orderBy } = {}) => {
      let result = Array.from(db.assemblyRevisions.values())
      if (where?.assemblyId) result = result.filter(r => r.assemblyId === where.assemblyId)
      if (where?.status) result = result.filter(r => r.status === where.status)
      if (where?.id?.in) result = result.filter(r => where.id.in.includes(r.id))
      if (select) return result.map(r => applySelect(r, select))
      return result
    },
    findUnique: async ({ where, include }) => {
      const rev = db.assemblyRevisions.get(where?.id)
      if (!rev) return null
      if (include?.coatingSnapshots) return { ...rev, coatingSnapshots: [] }
      return rev
    },
    update: async ({ where, data, include }) => {
      const rev = db.assemblyRevisions.get(where?.id)
      if (!rev) throw Object.assign(new Error('AssemblyRevision not found'), { code: 'P2025' })
      Object.assign(rev, data)
      if (include?.coatingSnapshots) return { ...rev, coatingSnapshots: [] }
      return rev
    },
    updateMany: async ({ where, data }) => {
      let count = 0
      for (const [, rev] of db.assemblyRevisions) {
        if (where?.assemblyId === rev.assemblyId) { Object.assign(rev, data); count++ }
      }
      return { count }
    },
    deleteMany: async ({ where }) => {
      let count = 0
      for (const [id, rev] of db.assemblyRevisions) {
        if (where?.assemblyId?.in?.includes(rev.assemblyId)) { db.assemblyRevisions.delete(id); count++ }
      }
      return { count }
    },
  },

  assemblyCoating: {
    create: async ({ data }) => {
      const coating = { id: uuid(), ...data }
      db.assemblyCoatings.set(coating.id, coating)
      return coating
    },
    findMany: async ({ where, include, orderBy } = {}) => {
      let result = Array.from(db.assemblyCoatings.values())
      if (where?.assemblyId?.in) result = result.filter(c => where.assemblyId.in.includes(c.assemblyId))
      if (where?.assemblyId && typeof where.assemblyId === 'string') {
        result = result.filter(c => c.assemblyId === where.assemblyId)
      }
      return result
    },
    deleteMany: async () => ({ count: 0 }),
  },

  assemblyRevisionCoatingSnapshot: {
    createMany: async ({ data }) => ({ count: Array.isArray(data) ? data.length : 0 }),
    deleteMany: async ()          => ({ count: 0 }),
  },

  quoteRevision: {
    create: async ({ data, include }) => {
      const qr = {
        id:             uuid(),
        orderId:        data.orderId,
        revisionNumber: data.revisionNumber,
        createdById:    data.createdById,
        status:         data.status || 'DRAFT',
        notes:          data.notes || null,
        currency:       data.currency || 'RUB',
        // Unpack nested creates
        parts:           (data.parts?.create || []).map(p => ({ id: uuid(), ...p })),
        assemblyCoatings:(data.assemblyCoatings?.create || []).map(c => ({ id: uuid(), ...c })),
        calculation:     data.calculation?.create ? { id: uuid(), ...data.calculation.create } : null,
        createdAt:       new Date(),
      }
      db.quoteRevisions.set(qr.id, qr)
      return qr
    },
    findFirst: async ({ where, orderBy } = {}) => {
      let result = Array.from(db.quoteRevisions.values())
      if (where?.orderId) result = result.filter(r => r.orderId === where.orderId)
      if (orderBy?.revisionNumber === 'desc') result.sort((a, b) => b.revisionNumber - a.revisionNumber)
      return result[0] || null
    },
    findMany: async ({ where, include, orderBy } = {}) => {
      let result = Array.from(db.quoteRevisions.values())
      if (where?.orderId) result = result.filter(r => r.orderId === where.orderId)
      if (orderBy?.revisionNumber === 'desc') result.sort((a, b) => b.revisionNumber - a.revisionNumber)
      return result
    },
    findUnique: async ({ where, select }) => {
      const qr = db.quoteRevisions.get(where?.id)
      if (!qr) return null
      if (select) return applySelect(qr, select)
      return qr
    },
    update: async ({ where, data }) => {
      const qr = db.quoteRevisions.get(where?.id)
      if (!qr) throw Object.assign(new Error('QuoteRevision not found'), { code: 'P2025' })
      Object.assign(qr, data)
      return qr
    },
  },

  auditLog: {
    create: async ({ data }) => {
      const log = { id: uuid(), ...data, createdAt: new Date() }
      db.auditLogs.push(log)
      return log
    },
  },
}

function resetDb() {
  db.orders.clear()
  db.assemblies.clear()
  db.parts.clear()
  db.assemblyRevisions.clear()
  db.assemblyCoatings.clear()
  db.assemblyRevisionCoatingSnapshots.clear()
  db.quoteRevisions.clear()
  db.auditLogs.length = 0
}

module.exports = { mockPrisma, COMPANY, USER, MOCK_MATERIAL, db, resetDb }
