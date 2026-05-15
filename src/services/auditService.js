const prisma = require('../repositories/prisma')

// Audit events are append-only ERP compliance records.
// Audit writes must never participate in business transactions.
// Audit payloads intentionally duplicate critical values for forensic reconstruction.

const AUDIT_EVENTS = {
  // Engineering revisions
  REVISION_DRAFT_CREATED:     'REVISION_DRAFT_CREATED',
  REVISION_FROZEN:            'REVISION_FROZEN',
  REVISION_CLONED:            'REVISION_CLONED',
  REVISION_RESTORED:          'REVISION_RESTORED',
  REVISION_RELEASED:          'REVISION_RELEASED',
  // Order lifecycle
  ORDER_STATUS_CHANGED:       'ORDER_STATUS_CHANGED',
  // Commercial
  QUOTE_REVISION_CREATED:     'QUOTE_REVISION_CREATED',
  QUOTE_REVISION_ACTIVATED:   'QUOTE_REVISION_ACTIVATED',
  QUOTE_REVISION_SUPERSEDED:  'QUOTE_REVISION_SUPERSEDED',
  // Structural topology
  ASSEMBLY_CREATED:           'ASSEMBLY_CREATED',
  ASSEMBLY_CLEARED:           'ASSEMBLY_CLEARED',
  PART_CREATED:               'PART_CREATED',
  // Integrity guards (best-effort only — never block response path)
  STRUCTURE_MUTATION_BLOCKED:     'STRUCTURE_MUTATION_BLOCKED',
  RESTORE_BLOCKED:                'RESTORE_BLOCKED',
  RELEASE_BLOCKED:                'RELEASE_BLOCKED',
  // Procurement
  PROCUREMENT_SNAPSHOT_GENERATED: 'PROCUREMENT_SNAPSHOT_GENERATED',
  PROCUREMENT_ACCESS_BLOCKED:     'PROCUREMENT_ACCESS_BLOCKED',
  // Material reservations
  MATERIAL_RESERVED:              'MATERIAL_RESERVED',
  MATERIAL_RESERVATION_BLOCKED:   'MATERIAL_RESERVATION_BLOCKED',
  MATERIAL_RESERVATION_CANCELLED: 'MATERIAL_RESERVATION_CANCELLED',
  // Inventory compatibility
  INVENTORY_SHORTAGE_DETECTED:    'INVENTORY_SHORTAGE_DETECTED',
  INVENTORY_BALANCE_REBUILT:      'INVENTORY_BALANCE_REBUILT',
}

// Maps custom event types to the existing AuditAction enum values in the schema.
const EVENT_TO_ACTION = {
  REVISION_DRAFT_CREATED:     'CREATE',
  REVISION_FROZEN:            'REVISION_SNAPSHOT',
  REVISION_CLONED:            'CREATE',
  REVISION_RESTORED:          'RESTORE',
  REVISION_RELEASED:          'STATUS_CHANGE',
  ORDER_STATUS_CHANGED:       'STATUS_CHANGE',
  QUOTE_REVISION_CREATED:     'CREATE',
  QUOTE_REVISION_ACTIVATED:   'STATUS_CHANGE',
  QUOTE_REVISION_SUPERSEDED:  'STATUS_CHANGE',
  ASSEMBLY_CREATED:           'CREATE',
  ASSEMBLY_CLEARED:           'DELETE',
  PART_CREATED:               'CREATE',
  STRUCTURE_MUTATION_BLOCKED:     'STATUS_CHANGE',
  RESTORE_BLOCKED:                'STATUS_CHANGE',
  RELEASE_BLOCKED:                'STATUS_CHANGE',
  PROCUREMENT_SNAPSHOT_GENERATED: 'REVISION_SNAPSHOT',
  PROCUREMENT_ACCESS_BLOCKED:     'STATUS_CHANGE',
  MATERIAL_RESERVED:              'CREATE',
  MATERIAL_RESERVATION_BLOCKED:   'STATUS_CHANGE',
  MATERIAL_RESERVATION_CANCELLED: 'STATUS_CHANGE',
  INVENTORY_SHORTAGE_DETECTED:    'STATUS_CHANGE',
  INVENTORY_BALANCE_REBUILT:      'REVISION_SNAPSHOT',
}

// In-memory cache — companyId is immutable for a running server instance.
let _cachedCompanyId = null

async function _resolveCompanyId(companyId) {
  if (companyId) return companyId
  if (_cachedCompanyId) return _cachedCompanyId
  const c = await prisma.company.findFirst({ select: { id: true } })
  if (c?.id) _cachedCompanyId = c.id
  return _cachedCompanyId ?? null
}

async function writeAuditEvent({
  eventType,
  entityType,
  entityId,
  actorId         = null,
  companyId       = null,
  orderId         = null,
  assemblyId      = null,
  revisionId      = null,
  quoteRevisionId = null,
  payload         = {},
}) {
  const resolvedCompanyId = await _resolveCompanyId(companyId)
  if (!resolvedCompanyId) {
    console.error('[audit] Cannot write audit event — companyId not resolved', { eventType, entityId })
    return
  }

  await prisma.auditLog.create({
    data: {
      companyId:  resolvedCompanyId,
      userId:     actorId || null,
      entity:     entityType,
      entityId,
      action:     EVENT_TO_ACTION[eventType] ?? 'STATUS_CHANGE',
      eventId:    eventType,
      snapshot:   {
        ...payload,
        _context: { orderId, assemblyId, revisionId, quoteRevisionId },
      },
    },
  })
}

// Wraps writeAuditEvent so callers never need their own try/catch.
// Business operations must never fail due to audit write failures.
function safeAudit(event) {
  writeAuditEvent(event).catch(err =>
    console.error('[audit] Audit write failed — business operation unaffected',
      err.message, { eventType: event.eventType, entityId: event.entityId })
  )
}

module.exports = { AUDIT_EVENTS, writeAuditEvent, safeAudit }
