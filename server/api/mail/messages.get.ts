/**
 * GET /api/mail/messages
 * Lists synced messages for the current user's assigned mailboxes.
 * Query: { mailboxId?, folder?, page?, limit? }
 */
import { z } from 'zod'
import { eq, and, inArray, desc, sql } from 'drizzle-orm'
import { mailMessage, memberMailboxAssignment } from '../../database/schema'

const querySchema = z.object({
  mailboxId: z.string().optional(),
  folder:    z.string().default('INBOX'),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(40),
})

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId   = session.session.activeOrganizationId
  const userId  = session.user.id
  const q       = await getValidatedQuery(event, querySchema.parse)

  // Find this user's assigned mailbox IDs
  const assignments = await db.query.memberMailboxAssignment.findMany({
    where: (t, { eq, and }) => and(eq(t.userId, userId), eq(t.organizationId, orgId)),
    columns: { organizationMailboxId: true },
  })
  const mailboxIds = assignments.map(a => a.organizationMailboxId)
    .filter(id => !q.mailboxId || id === q.mailboxId)

  if (mailboxIds.length === 0) return { data: [], total: 0, page: q.page, limit: q.limit }

  const offset = (q.page - 1) * q.limit

  const [messages, [{ count }]] = await Promise.all([
    db.query.mailMessage.findMany({
      where: (t, { and, eq, inArray }) => and(
        inArray(t.organizationMailboxId, mailboxIds),
        eq(t.folder, q.folder),
      ),
      orderBy: (t, { desc }) => desc(t.sentAt),
      limit:  q.limit,
      offset,
      columns: {
        id: true, uid: true, folder: true,
        fromName: true, fromEmail: true,
        subject: true, sentAt: true,
        isRead: true, isFlagged: true,
        organizationMailboxId: true,
        bodyText: false, bodyHtml: false, toJson: false, ccJson: false,
      },
    }),
    db.select({ count: sql<number>`count(*)::int` })
      .from(mailMessage)
      .where(
        and(
          inArray(mailMessage.organizationMailboxId, mailboxIds),
          eq(mailMessage.folder, q.folder),
        )
      ),
  ])

  return { data: messages, total: count, page: q.page, limit: q.limit }
})
