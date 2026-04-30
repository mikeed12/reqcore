/**
 * GET /api/mail/folders
 * Returns per-folder message counts for the current user's assigned mailboxes.
 * Response: Array<{ mailboxId, folder, total, unread }>
 */
import { eq, and, inArray, sql, count } from 'drizzle-orm'
import { mailMessage, memberMailboxAssignment } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId  = session.session.activeOrganizationId
  const userId = session.user.id

  const assignments = await db.query.memberMailboxAssignment.findMany({
    where: (t, { eq, and }) => and(eq(t.userId, userId), eq(t.organizationId, orgId)),
    columns: { organizationMailboxId: true },
  })
  const mailboxIds = assignments.map(a => a.organizationMailboxId)
  if (mailboxIds.length === 0) return []

  const rows = await db
    .select({
      mailboxId: mailMessage.organizationMailboxId,
      folder:    mailMessage.folder,
      total:     sql<number>`count(*)::int`,
      unread:    sql<number>`count(*) filter (where ${mailMessage.isRead} = false)::int`,
    })
    .from(mailMessage)
    .where(inArray(mailMessage.organizationMailboxId, mailboxIds))
    .groupBy(mailMessage.organizationMailboxId, mailMessage.folder)

  return rows
})
