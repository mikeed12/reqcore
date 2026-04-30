import { desc, eq, and, sql } from 'drizzle-orm'
import { conversation, candidate } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId

  const type = getQuery(event).type as string | undefined
  const status = getQuery(event).status as string | undefined

  const conditions = [eq(conversation.organizationId, orgId)]
  if (type && ['task', 'support', 'chat'].includes(type)) {
    conditions.push(eq(conversation.type, type as 'task' | 'support' | 'chat'))
  }
  if (status && ['open', 'closed'].includes(status)) {
    conditions.push(eq(conversation.status, status as 'open' | 'closed'))
  }

  const rows = await db
    .select({
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      status: conversation.status,
      candidateId: conversation.candidateId,
      applicationId: conversation.applicationId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      candidateFirstName: candidate.firstName,
      candidateLastName: candidate.lastName,
      candidateEmail: candidate.email,
      lastMessage: sql<string | null>`(
        SELECT content FROM "message"
        WHERE conversation_id = ${conversation.id}
        ORDER BY created_at DESC
        LIMIT 1
      )`,
      lastMessageAt: sql<string | null>`(
        SELECT created_at FROM "message"
        WHERE conversation_id = ${conversation.id}
        ORDER BY created_at DESC
        LIMIT 1
      )`,
      unreadCount: sql<number>`(
        SELECT COUNT(*) FROM "message"
        WHERE conversation_id = ${conversation.id}
          AND sender_type = 'candidate'
          AND read_at IS NULL
      )::int`,
    })
    .from(conversation)
    .leftJoin(candidate, eq(conversation.candidateId, candidate.id))
    .where(and(...conditions))
    .orderBy(desc(conversation.updatedAt))

  return rows
})
