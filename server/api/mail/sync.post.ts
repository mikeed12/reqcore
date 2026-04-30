/**
 * POST /api/mail/sync
 * Syncs one or all of the current user's assigned mailboxes.
 * Body: { mailboxId?: string }  — omit to sync all assigned mailboxes.
 */
import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { organizationMailbox, memberMailboxAssignment } from '../../database/schema'
import { syncMailbox } from '../../utils/imap'

const bodySchema = z.object({
  mailboxId: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId   = session.session.activeOrganizationId
  const userId  = session.user.id
  const body    = await readValidatedBody(event, bodySchema.parse)

  // Find mailboxes this user is assigned to
  const assignments = await db.query.memberMailboxAssignment.findMany({
    where: (t, { eq, and }) => and(
      eq(t.userId, userId),
      eq(t.organizationId, orgId),
      ...(body.mailboxId ? [eq(t.organizationMailboxId, body.mailboxId)] : []),
    ),
    columns: { organizationMailboxId: true },
  })

  if (assignments.length === 0) {
    return { results: [] }
  }

  const mailboxIds = assignments.map(a => a.organizationMailboxId)
  const mailboxes  = await db.query.organizationMailbox.findMany({
    where: (t, { and, eq, inArray }) => and(
      eq(t.organizationId, orgId),
      eq(t.isActive, true),
      inArray(t.id, mailboxIds),
    ),
  })

  const results = await Promise.all(
    mailboxes.map(async (mb) => {
      const r = await syncMailbox(mb)
      return { mailboxId: mb.id, label: mb.label, ...r }
    })
  )

  return { results }
})
