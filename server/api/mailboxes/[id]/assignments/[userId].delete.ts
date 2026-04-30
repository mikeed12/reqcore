import { eq, and } from 'drizzle-orm'
import { organizationMailbox, memberMailboxAssignment } from '../../../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { organization: ['update'] })
  const orgId = session.session.activeOrganizationId
  const mailboxId = getRouterParam(event, 'id')!
  const userId    = getRouterParam(event, 'userId')!

  // Verify mailbox belongs to org
  const mailbox = await db.query.organizationMailbox.findFirst({
    where: (t, { eq, and }) => and(eq(t.id, mailboxId), eq(t.organizationId, orgId)),
    columns: { id: true },
  })
  if (!mailbox) throw createError({ statusCode: 404, statusMessage: 'Mailbox not found' })

  await db
    .delete(memberMailboxAssignment)
    .where(
      and(
        eq(memberMailboxAssignment.organizationMailboxId, mailboxId),
        eq(memberMailboxAssignment.userId, userId),
        eq(memberMailboxAssignment.organizationId, orgId),
      )
    )

  return { ok: true }
})
