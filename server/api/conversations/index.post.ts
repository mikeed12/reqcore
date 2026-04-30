import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { conversation, message, candidate } from '../../database/schema'
import { wsRooms } from '../../utils/ws-rooms'

const bodySchema = z.object({
  candidateId: z.string().min(1),
  type: z.enum(['task', 'support', 'chat']),
  // For 'chat' type the title is ignored — it's auto-set to the sender's display name
  title: z.string().max(200).default(''),
  initialMessage: z.string().min(1).max(5000),
  applicationId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const body = await readValidatedBody(event, bodySchema.parse)

  // Verify candidate belongs to org
  const candidateRow = await db.query.candidate.findFirst({
    where: (c, { and, eq }) => and(eq(c.id, body.candidateId), eq(c.organizationId, orgId)),
    columns: { id: true, firstName: true, lastName: true },
  })
  if (!candidateRow) throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })

  const senderName = (session.user.name || session.user.email || 'Team').trim()

  // For chat conversations the title is the admin's display name so the
  // candidate sees who they're talking to. For tasks/support use the provided title.
  const effectiveTitle = body.type === 'chat' ? senderName : body.title.trim()
  if (!effectiveTitle) throw createError({ statusCode: 400, statusMessage: 'Title is required' })

  const now = new Date()
  const convId = crypto.randomUUID()

  await db.insert(conversation).values({
    id: convId,
    organizationId: orgId,
    candidateId: body.candidateId,
    type: body.type,
    title: effectiveTitle,
    status: 'open',
    applicationId: body.applicationId ?? null,
    metadata: body.metadata ?? null,
    createdAt: now,
    updatedAt: now,
  })

  const msgId = crypto.randomUUID()
  await db.insert(message).values({
    id: msgId,
    conversationId: convId,
    senderType: 'admin',
    senderId: session.user.id,
    senderName,
    content: body.initialMessage,
    createdAt: now,
  })

  const candidateName = `${candidateRow.firstName} ${candidateRow.lastName}`.trim()

  const payload = {
    type: 'new_conversation',
    conversation: {
      id: convId,
      type: body.type,
      title: effectiveTitle,
      status: 'open',
      organizationId: orgId,
      candidateId: body.candidateId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    firstMessage: {
      id: msgId,
      conversationId: convId,
      senderType: 'admin',
      senderId: session.user.id,
      senderName,
      content: body.initialMessage,
      createdAt: now.toISOString(),
    },
  }

  // Notify candidate inbox
  wsRooms.broadcast(`inbox:candidate:${body.candidateId}`, payload)
  // Notify all org admins
  wsRooms.broadcast(`inbox:org:${orgId}`, payload)

  return { id: convId, candidateName }
})
