import { eq, and } from 'drizzle-orm'
import { conversation, message } from '../../../database/schema'
import { wsRooms } from '../../../utils/ws-rooms'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const convId = getRouterParam(event, 'id')!

  const conv = await db.query.conversation.findFirst({
    where: and(
      eq(conversation.id, convId),
      eq(conversation.organizationId, orgId),
    ),
  })
  if (!conv) throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })

  // Delete messages first (FK constraint), then the conversation
  await db.delete(message).where(eq(message.conversationId, convId))
  await db.delete(conversation).where(eq(conversation.id, convId))

  // Notify any connected peers that this conversation is gone
  wsRooms.broadcast(`conv:${convId}`, { type: 'conversation_deleted', conversationId: convId })

  return { ok: true }
})
