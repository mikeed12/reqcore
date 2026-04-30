/**
 * GET /api/mail/messages/:id  — fetch a single message with body.
 * Also marks it as read.
 */
import { eq, and, inArray } from 'drizzle-orm'
import { mailMessage, memberMailboxAssignment } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId   = session.session.activeOrganizationId
  const userId  = session.user.id
  const id      = getRouterParam(event, 'id')!

  const assignments = await db.query.memberMailboxAssignment.findMany({
    where: (t, { eq, and }) => and(eq(t.userId, userId), eq(t.organizationId, orgId)),
    columns: { organizationMailboxId: true },
  })
  const mailboxIds = assignments.map(a => a.organizationMailboxId)

  const msg = await db.query.mailMessage.findFirst({
    where: (t, { eq, and, inArray }) => and(
      eq(t.id, id),
      inArray(t.organizationMailboxId, mailboxIds),
    ),
  })

  if (!msg) throw createError({ statusCode: 404, statusMessage: 'Message not found' })

  // Mark as read
  if (!msg.isRead) {
    await db.update(mailMessage).set({ isRead: true }).where(eq(mailMessage.id, id))
  }

  return { ...msg, isRead: true }
})
