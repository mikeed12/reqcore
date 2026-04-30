import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { conversation, message } from '../../../database/schema'
import { wsRooms } from '../../../utils/ws-rooms'

const bodySchema = z.object({
  status: z.enum(['open', 'closed']),
})

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const convId = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, bodySchema.parse)

  const conv = await db.query.conversation.findFirst({
    where: and(
      eq(conversation.id, convId),
      eq(conversation.organizationId, orgId),
    ),
  })
  if (!conv) throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })

  const now = new Date()
  await db
    .update(conversation)
    .set({ status: body.status, updatedAt: now })
    .where(eq(conversation.id, convId))

  // Post a system message announcing the status change
  const systemMsg = {
    id: crypto.randomUUID(),
    conversationId: convId,
    senderType: 'system' as const,
    senderId: null,
    senderName: 'System',
    content: body.status === 'closed'
      ? `Conversation closed by ${session.user.name || session.user.email}.`
      : `Conversation reopened by ${session.user.name || session.user.email}.`,
    readAt: null,
    createdAt: now.toISOString(),
  }

  await db.insert(message).values({
    ...systemMsg,
    createdAt: now,
  })

  wsRooms.broadcast(`conv:${convId}`, { type: 'status_changed', status: body.status, conversationId: convId, message: systemMsg })

  return { ok: true, status: body.status }
})
