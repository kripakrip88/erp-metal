const prisma = require('../repositories/prisma')
const { AUDIT_EVENTS, safeAudit } = require('./auditService')

// ─── 5.4.3 — Order status transition engine ───────────────────────────────────

// Allowed forward and backward transitions per status.
// Backward transitions (e.g. QUOTATION → DRAFT) are permitted where business
// process allows rework. Forward skips (e.g. DRAFT → PRODUCTION) are blocked.
const ALLOWED_TRANSITIONS = {
  DRAFT:             ['QUOTATION', 'CANCELLED'],
  QUOTATION:         ['AWAITING_APPROVAL', 'DRAFT', 'CANCELLED'],
  AWAITING_APPROVAL: ['APPROVED', 'QUOTATION', 'CANCELLED'],
  APPROVED:          ['PRODUCTION', 'QUOTATION', 'CANCELLED'],
  PRODUCTION:        ['COMPLETED'],
  COMPLETED:         ['DELIVERED'],
  // DELIVERED and CANCELLED are terminal states.
  // No further transitions allowed.
  DELIVERED:         [],
  CANCELLED:         [],
}

// Statuses that require every assembly to have a pinned FROZEN releasedRevisionId.
// Production orders must always point to immutable frozen revisions.
// Never allow PRODUCTION state without releasedRevisionId on every assembly.
const RELEASE_GATE_STATUSES = new Set(['APPROVED', 'PRODUCTION'])

// ─── Transition validation ────────────────────────────────────────────────────

// Pure function — no DB. Throws explicitly on any invalid transition.
function validateOrderStatusTransition(currentStatus, nextStatus) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus]
  if (allowed === undefined) {
    throw new Error(`Unknown order status: "${currentStatus}"`)
  }
  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Invalid transition: ${currentStatus} → ${nextStatus}. ` +
      `Allowed from ${currentStatus}: [${allowed.join(', ') || 'none'}]`
    )
  }
}

// ─── Release validation ───────────────────────────────────────────────────────

// Validates that every assembly on the order has a pinned, FROZEN released revision.
// Runs inside the parent transaction (tx) to read a consistent snapshot.
// Uses a single batched revision query — no N+1.
async function validateAssembliesReadyForRelease(orderId, tx = prisma) {
  const order = await tx.order.findUnique({
    where:   { id: orderId },
    select:  {
      id:         true,
      assemblies: { select: { id: true, name: true, orderId: true, releasedRevisionId: true } },
    },
  })
  if (!order) throw new Error('Order not found')
  if (order.assemblies.length === 0) {
    throw new Error('Order has no assemblies — cannot release an empty order')
  }

  // Batch-load all referenced revisions in one query
  const pinnedIds = order.assemblies
    .map(a => a.releasedRevisionId)
    .filter(Boolean)

  const revisions = pinnedIds.length > 0
    ? await tx.assemblyRevision.findMany({
        where:  { id: { in: pinnedIds } },
        select: { id: true, assemblyId: true, status: true },
      })
    : []

  const revMap = Object.fromEntries(revisions.map(r => [r.id, r]))

  for (const asm of order.assemblies) {
    // Guard against stale assembly reassignment inside the transaction
    if (asm.orderId !== orderId) {
      throw new Error(`Assembly "${asm.name}" does not belong to order`)
    }
    if (!asm.releasedRevisionId) {
      throw new Error(`Assembly "${asm.name}" has no released revision`)
    }
    const rev = revMap[asm.releasedRevisionId]
    if (!rev) {
      throw new Error(`Released revision for assembly "${asm.name}" not found`)
    }
    if (rev.assemblyId !== asm.id) {
      throw new Error(`Released revision does not belong to assembly "${asm.name}"`)
    }
    if (rev.status !== 'FROZEN') {
      throw new Error(`Released revision for assembly "${asm.name}" is not frozen`)
    }
  }
}

// ─── Auto-release ─────────────────────────────────────────────────────────────

// Auto-pins Assembly.releasedRevisionId for any assembly that does not yet have one.
// Finds the latest FROZEN revision (frozenAt DESC) for each unpinned assembly.
// Throws if an assembly has no frozen revision at all.
// IMPORTANT: skips assemblies that already have releasedRevisionId — never overwrites
// a manually pinned production baseline without explicit operator action.
// Runs inside the parent transaction (tx) to keep the pin + status update atomic.
// Returns the list of assembly IDs that were auto-pinned during this call
// (assemblies that previously had no releasedRevisionId).
async function applyOrderRelease(orderId, tx = prisma) {
  const assemblies = await tx.assembly.findMany({
    where:  { orderId },
    select: { id: true, name: true, releasedRevisionId: true },
  })

  const autoReleased = []
  for (const asm of assemblies) {
    if (asm.releasedRevisionId) continue

    const frozenRevision = await tx.assemblyRevision.findFirst({
      where:   { assemblyId: asm.id, status: 'FROZEN' },
      orderBy: [{ frozenAt: 'desc' }, { revisionNumber: 'desc' }],
      select:  { id: true },
    })
    if (!frozenRevision) {
      throw new Error(
        `Assembly "${asm.name}" has no frozen revision — ` +
        'freeze a revision before releasing the order'
      )
    }

    await tx.assembly.update({
      where: { id: asm.id },
      data:  { releasedRevisionId: frozenRevision.id },
    })
    autoReleased.push(asm.id)
  }
  return autoReleased
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

// Transitions an order to nextStatus with full lifecycle integrity:
// 1. Validates the transition is allowed.
// 2. If advancing to APPROVED or PRODUCTION, auto-pins and validates released revisions.
// 3. Updates order.status atomically with the release operations.
// All DB mutations run inside a single transaction — partial failure rolls back fully.
async function transitionOrderStatus(orderId, nextStatus, _opts = {}) {
  // Pre-check outside the transaction — fast, no lock held yet.
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id: true, status: true },
  })
  if (!order) throw new Error('Order not found')

  // Audit blocked transitions before re-throwing (best-effort, never blocks response).
  try {
    validateOrderStatusTransition(order.status, nextStatus)
  } catch (err) {
    safeAudit({
      eventType:  AUDIT_EVENTS.RELEASE_BLOCKED,
      entityType: 'ORDER',
      entityId:   orderId,
      orderId,
      payload:    { reason: err.message, fromStatus: order.status, attemptedStatus: nextStatus },
    })
    throw err
  }

  const fromStatus     = order.status
  const requiresRelease = RELEASE_GATE_STATUSES.has(nextStatus)
  let autoReleasedAssemblies = []

  const result = await prisma.$transaction(async (tx) => {
    // Re-read inside tx: status may have changed between the pre-check and tx start.
    const current = await tx.order.findUnique({
      where:  { id: orderId },
      select: { status: true },
    })
    // Re-validate inside tx for consistency (prevents TOCTOU on status).
    validateOrderStatusTransition(current.status, nextStatus)

    if (requiresRelease) {
      // Auto-pin any unpinned assemblies — must run before validation.
      autoReleasedAssemblies = await applyOrderRelease(orderId, tx)
      // Validate every assembly now has a valid frozen released revision.
      await validateAssembliesReadyForRelease(orderId, tx)
    }

    return tx.order.update({
      where:  { id: orderId },
      data:   { status: nextStatus },
      select: { id: true, status: true, activeQuoteRevisionId: true },
    })
  })

  safeAudit({
    eventType:  AUDIT_EVENTS.ORDER_STATUS_CHANGED,
    entityType: 'ORDER',
    entityId:   orderId,
    orderId,
    payload:    { fromStatus, toStatus: nextStatus, autoReleasedAssemblies },
  })
  return result
}

module.exports = {
  validateOrderStatusTransition,
  validateAssembliesReadyForRelease,
  applyOrderRelease,
  transitionOrderStatus,
}
