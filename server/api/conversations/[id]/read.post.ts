import { eq, and, isNull } from 'drizzle-orm'
import { conversation, message } from '../../../database/schema'

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

  // Mark all candidate messages in this conversation as read
  await db
    .update(message)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(message.conversationId, convId),
        eq(message.senderType, 'candidate'),
        isNull(message.readAt),
      ),
    )

  return { ok: true }
})
