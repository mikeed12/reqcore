import { desc, eq, inArray, sql, and } from 'drizzle-orm'
import { z } from 'zod'
import { conversation, message, candidate } from '../../../../database/schema'
import { requireCabinetAuth } from '../../../../utils/cabinet-auth'

const querySchema = z.object({
  type: z.enum(['task', 'support', 'chat']).optional(),
})

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)
  const { type } = await getValidatedQuery(event, querySchema.parse)

  const whereClause = type
    ? and(inArray(conversation.candidateId, candidateIds), eq(conversation.type, type))
    : inArray(conversation.candidateId, candidateIds)

  const rows = await db
    .select({
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
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
          AND sender_type = 'admin'
          AND read_at IS NULL
      )::int`,
    })
    .from(conversation)
    .where(whereClause)
    .orderBy(desc(conversation.updatedAt))

  return rows
})
