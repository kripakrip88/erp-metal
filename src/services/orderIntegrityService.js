const prisma = require('../repositories/prisma')
const { LOCKED_ORDER_STATUSES } = require('./assemblyRevisionService')

// ─── 5.4.4 — Order / Assembly structural immutability guards ──────────────────

// Released assemblies are structurally immutable.
// Never mutate fabrication topology after release.

// Re-export so consumers can use the constant without an extra import.
// Single source of truth lives in assemblyRevisionService.js.
module.exports.LOCKED_ORDER_STATUSES = LOCKED_ORDER_STATUSES

// Topology operations (add/remove assemblies, modify parts) are blocked earlier
// than coating/revision mutations. APPROVED means commercial acceptance — the
// fabrication spec must already be stable before production begins.
const TOPOLOGY_LOCKED_STATUSES = ['APPROVED', 'PRODUCTION', 'COMPLETED', 'DELIVERED']
module.exports.TOPOLOGY_LOCKED_STATUSES = TOPOLOGY_LOCKED_STATUSES

// ─── assertOrderEditable ──────────────────────────────────────────────────────

// Generic order-level mutation guard.
// Blocks non-structural order changes (metadata, notes, commercial data) when
// the order has advanced into a locked production lifecycle state.
// Use for: updateOrder comments/notes, setActiveQuoteRevision, phase renames.
// Does NOT check assembly-level freeze state — use assertAssemblyStructureMutable
// for fabrication topology mutations.
async function assertOrderEditable(orderId) {
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id: true, status: true },
  })
  if (!order) throw new Error('Order not found')
  if (LOCKED_ORDER_STATUSES.includes(order.status)) {
    throw new Error(`Order is locked in production lifecycle (${order.status})`)
  }
  return order
}

// ─── assertAssemblyStructureMutable ──────────────────────────────────────────

// Protects assembly fabrication topology: parts, weights, geometry, BOM spec.
// Blocks on either condition — once a released revision exists, the fabrication
// spec is production-pinned even if the order is still in an earlier status.
// Use for: createPart, updatePart, deletePart, reorderParts, bulkCreateParts.
//
// This is DIFFERENT from assertAssemblyMutable (coatingService):
//   assertAssemblyMutable     → protects coating workspace (frozen revision check)
//   assertAssemblyStructureMutable → protects fabrication topology (released revision check)
async function assertAssemblyStructureMutable(assemblyId) {
  const [asm, frozenRevision] = await Promise.all([
    prisma.assembly.findUnique({
      where:  { id: assemblyId },
      select: {
        releasedRevisionId: true,
        order: { select: { status: true } },
      },
    }),
    prisma.assemblyRevision.findFirst({
      where:  { assemblyId, status: 'FROZEN' },
      select: { id: true },
    }),
  ])
  if (!asm) throw new Error('Assembly not found')
  // releasedRevisionId check comes first — more precise error for released assemblies
  if (asm.releasedRevisionId) {
    throw new Error('Assembly structure is locked by released revision')
  }
  if (frozenRevision) {
    throw new Error('Assembly structure is locked by frozen revision')
  }
  if (LOCKED_ORDER_STATUSES.includes(asm.order.status)) {
    throw new Error(`Assembly is locked in production lifecycle (${asm.order.status})`)
  }
}

// ─── assertOrderStructureMutable ─────────────────────────────────────────────

// Protects order topology: assembly creation/deletion, phase changes.
// Blocks when the order is in a locked lifecycle state.
// Use for: createAssembly, deleteAssembly, duplicateAssembly,
//          createPhase, updatePhase, deletePhase.
async function assertOrderStructureMutable(orderId) {
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id: true, status: true },
  })
  if (!order) throw new Error('Order not found')
  if (TOPOLOGY_LOCKED_STATUSES.includes(order.status)) {
    throw new Error(`Order structure is locked in production lifecycle (${order.status})`)
  }
  return order
}

module.exports.assertOrderEditable          = assertOrderEditable
module.exports.assertAssemblyStructureMutable = assertAssemblyStructureMutable
module.exports.assertOrderStructureMutable  = assertOrderStructureMutable
