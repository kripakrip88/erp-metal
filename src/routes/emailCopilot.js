const { json }        = require('../utils/response')
const { parseBody }   = require('../utils/parseBody')
const { requireRole } = require('../middleware/requireRole')
const prisma          = require('../repositories/prisma')

const canReply = requireRole('ADMIN', 'MANAGER', 'ENGINEER')

module.exports = [
  {
    method: 'POST',
    pathname: '/api/email-copilot/log-reply',
    handler: async (req, res) => {
      if (!canReply(req, res)) return
      try {
        const body = await parseBody(req)
        const { messageId, replyBody, subject } = body

        if (!messageId)  return json(res, { error: 'messageId is required' }, 400)
        if (!replyBody)  return json(res, { error: 'replyBody is required' }, 400)

        const actorId = req.context?.userId    || null
        const companyId = req.context?.companyId || null

        // Find the original inbound Interaction by emailMessageId
        const inbound = await prisma.interaction.findUnique({
          where:   { emailMessageId: messageId },
          include: {
            order: { select: { id: true, orderNumber: true, status: true } },
          },
        })

        if (!inbound) {
          // No linked order — just acknowledge (reply sent without RFQ)
          return json(res, { logged: false, reason: 'No linked interaction found' })
        }

        const customerId = inbound.customerId
        const orderId    = inbound.orderId

        // Resolve actorId fallback
        let resolvedActorId = actorId
        if (!resolvedActorId && companyId) {
          const user = await prisma.user.findFirst({
            where:  { companyId, isActive: true },
            select: { id: true },
          })
          resolvedActorId = user?.id ?? null
        }

        const replySubject = subject || (inbound.subject ? 'Re: ' + inbound.subject : 'Re: (без темы)')

        const result = await prisma.$transaction(async (tx) => {
          // Create OUTBOUND Interaction (no emailMessageId — outbound, SMTP-assigned)
          const interaction = await tx.interaction.create({
            data: {
              customerId,
              orderId:     orderId || undefined,
              type:        'EMAIL',
              direction:   'OUTBOUND',
              subject:     replySubject,
              body:        replyBody,
              createdById: resolvedActorId || customerId, // fallback to customerId if no user
            },
            select: { id: true },
          })

          let statusChanged = false
          let orderNumber   = inbound.order?.orderNumber ?? null

          // Auto-transition DRAFT → QUOTATION when first reply sent
          if (orderId && inbound.order?.status === 'DRAFT') {
            await tx.order.update({
              where: { id: orderId },
              data:  { status: 'QUOTATION' },
            })
            statusChanged = true
          }

          return { interactionId: interaction.id, orderId, orderNumber, statusChanged }
        })

        json(res, { logged: true, ...result })
      } catch (err) {
        console.error('[log-reply] error:', err.message)
        json(res, { error: err.message }, err.status || 500)
      }
    },
  },
]
