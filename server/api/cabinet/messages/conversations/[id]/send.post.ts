import { z } from 'zod'
import { eq, inArray, and } from 'drizzle-orm'
import { conversation, message, candidate } from '../../../../../database/schema'
import { requireCabinetAuth } from '../../../../../utils/cabinet-auth'
import { wsRooms } from '../../../../../utils/ws-rooms'

const bodySchema = z.object({
  content: z.string().min(1).max(5000),
})

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)
  const convId = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, bodySchema.parse)

  // Verify conversation belongs to this candidate
  const conv = await db.query.conversation.findFirst({
    where: and(
      eq(conversation.id, convId),
      inArray(conversation.candidateId, candidateIds),
    ),
  })
  if (!conv) throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })
  if (conv.status === 'closed') throw createError({ statusCode: 409, statusMessage: 'Conversation is closed' })

  // Resolve sender name
  const candidateRow = await db.query.candidate.findFirst({
    where: inArray(candidate.id, candidateIds),
    columns: { id: true, firstName: true, lastName: true },
  })
  if (!candidateRow) throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })

  const now = new Date()
  const msgId = crypto.randomUUID()
  const senderName = `${candidateRow.firstName} ${candidateRow.lastName}`.trim()

  await db.insert(message).values({
    id: msgId,
    conversationId: convId,
    senderType: 'candidate',
    senderId: candidateRow.id,
    senderName,
    content: body.content,
    createdAt: now,
  })

  // Bump conversation updatedAt
  await db
    .update(conversation)
    .set({ updatedAt: now })
    .where(eq(conversation.id, convId))

  const msg = {
    id: msgId,
    conversationId: convId,
    senderType: 'candidate',
    senderId: candidateRow.id,
    senderName,
    content: body.content,
    readAt: null,
    createdAt: now.toISOString(),
  }

  wsRooms.broadcast(`conv:${convId}`, { type: 'new_message', message: msg, conversationId: convId })

  return msg
})
