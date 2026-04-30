import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { conversation, message } from '../../../database/schema'
import { wsRooms } from '../../../utils/ws-rooms'

const bodySchema = z.object({
  content: z.string().min(1).max(5000),
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
  if (conv.status === 'closed') throw createError({ statusCode: 409, statusMessage: 'Conversation is closed' })

  const now = new Date()
  const msgId = crypto.randomUUID()
  const senderName = session.user.name || session.user.email

  await db.insert(message).values({
    id: msgId,
    conversationId: convId,
    senderType: 'admin',
    senderId: session.user.id,
    senderName,
    content: body.content,
    createdAt: now,
  })

  await db
    .update(conversation)
    .set({ updatedAt: now })
    .where(eq(conversation.id, convId))

  const msg = {
    id: msgId,
    conversationId: convId,
    senderType: 'admin',
    senderId: session.user.id,
    senderName,
    content: body.content,
    readAt: null,
    createdAt: now.toISOString(),
  }

  wsRooms.broadcast(`conv:${convId}`, { type: 'new_message', message: msg, conversationId: convId })

  return msg
})
