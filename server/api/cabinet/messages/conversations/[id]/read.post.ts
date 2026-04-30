import { eq, inArray, and, isNull } from 'drizzle-orm'
import { conversation, message } from '../../../../../database/schema'
import { requireCabinetAuth } from '../../../../../utils/cabinet-auth'

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)
  const convId = getRouterParam(event, 'id')!

  // Verify ownership
  const conv = await db.query.conversation.findFirst({
    where: and(
      eq(conversation.id, convId),
      inArray(conversation.candidateId, candidateIds),
    ),
  })
  if (!conv) throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })

  // Mark all admin messages as read
  await db
    .update(message)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(message.conversationId, convId),
        eq(message.senderType, 'admin'),
        isNull(message.readAt),
      ),
    )

  return { ok: true }
})
