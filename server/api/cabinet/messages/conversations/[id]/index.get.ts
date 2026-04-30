import { eq, asc, inArray, and } from 'drizzle-orm'
import { conversation, message } from '../../../../../database/schema'
import { requireCabinetAuth } from '../../../../../utils/cabinet-auth'

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)
  const convId = getRouterParam(event, 'id')!

  // Verify this conversation belongs to one of the candidate's IDs
  const conv = await db.query.conversation.findFirst({
    where: and(
      eq(conversation.id, convId),
      inArray(conversation.candidateId, candidateIds),
    ),
  })
  if (!conv) throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })

  const messages = await db
    .select()
    .from(message)
    .where(eq(message.conversationId, convId))
    .orderBy(asc(message.createdAt))

  return { conversation: conv, messages }
})
