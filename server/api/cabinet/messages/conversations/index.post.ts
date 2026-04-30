import { z } from 'zod'
import { inArray } from 'drizzle-orm'
import { conversation, message, candidate } from '../../../../database/schema'
import { requireCabinetAuth } from '../../../../utils/cabinet-auth'
import { wsRooms } from '../../../../utils/ws-rooms'

const bodySchema = z.object({
  type: z.enum(['support']),
  title: z.string().min(1).max(200),
  initialMessage: z.string().min(1).max(5000),
})

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  // Resolve the candidate (pick first — one session can span multiple orgs)
  const candidateRow = await db.query.candidate.findFirst({
    where: inArray(candidate.id, candidateIds),
    columns: { id: true, organizationId: true, firstName: true, lastName: true },
  })
  if (!candidateRow) throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })

  const { id: candidateId, organizationId, firstName, lastName } = candidateRow
  const senderName = `${firstName} ${lastName}`.trim()
  const now = new Date()

  // Create conversation
  const convId = crypto.randomUUID()
  await db.insert(conversation).values({
    id: convId,
    organizationId,
    candidateId,
    type: body.type,
    title: body.title,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  })

  // Create initial message
  const msgId = crypto.randomUUID()
  await db.insert(message).values({
    id: msgId,
    conversationId: convId,
    senderType: 'candidate',
    senderId: candidateId,
    senderName,
    content: body.initialMessage,
    createdAt: now,
  })

  const payload = {
    type: 'new_conversation',
    conversation: {
      id: convId,
      type: body.type,
      title: body.title,
      status: 'open',
      organizationId,
      candidateId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    firstMessage: {
      id: msgId,
      conversationId: convId,
      senderType: 'candidate',
      senderId: candidateId,
      senderName,
      content: body.initialMessage,
      createdAt: now.toISOString(),
    },
  }

  // Notify admin inbox
  wsRooms.broadcast(`inbox:org:${organizationId}`, payload)
  // Notify the candidate's own inbox (so other devices subscribe to new room)
  wsRooms.broadcast(`inbox:candidate:${candidateId}`, payload)

  return { id: convId }
})
