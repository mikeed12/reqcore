import { eq, and, asc } from 'drizzle-orm'
import { conversation, message, candidate } from '../../../database/schema'

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

  const candidateRow = await db.query.candidate.findFirst({
    where: eq(candidate.id, conv.candidateId),
    columns: { firstName: true, lastName: true, email: true },
  })

  const messages = await db
    .select()
    .from(message)
    .where(eq(message.conversationId, convId))
    .orderBy(asc(message.createdAt))

  return {
    conversation: {
      ...conv,
      candidateName: candidateRow ? `${candidateRow.firstName} ${candidateRow.lastName}`.trim() : '',
      candidateEmail: candidateRow?.email ?? '',
    },
    messages,
  }
})
