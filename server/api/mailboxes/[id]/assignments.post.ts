import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { organizationMailbox, memberMailboxAssignment } from '../../../database/schema'
import { member } from '../../../database/schema/auth'

const bodySchema = z.object({
  userId:    z.string().min(1),
  isPrimary: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { organization: ['update'] })
  const orgId = session.session.activeOrganizationId
  const mailboxId = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, bodySchema.parse)

  // Verify mailbox belongs to org
  const mailbox = await db.query.organizationMailbox.findFirst({
    where: (t, { eq, and }) => and(eq(t.id, mailboxId), eq(t.organizationId, orgId)),
    columns: { id: true },
  })
  if (!mailbox) throw createError({ statusCode: 404, statusMessage: 'Mailbox not found' })

  // Verify user is a member of the org
  const memberRow = await db.query.member.findFirst({
    where: (t, { eq, and }) => and(eq(t.userId, body.userId), eq(t.organizationId, orgId)),
    columns: { id: true },
  })
  if (!memberRow) throw createError({ statusCode: 404, statusMessage: 'Member not found' })

  const [assignment] = await db
    .insert(memberMailboxAssignment)
    .values({
      organizationMailboxId: mailboxId,
      userId:                body.userId,
      organizationId:        orgId,
      isPrimary:             body.isPrimary,
    })
    .onConflictDoUpdate({
      target: [memberMailboxAssignment.userId, memberMailboxAssignment.organizationMailboxId],
      set:    { isPrimary: body.isPrimary },
    })
    .returning()

  return assignment
})
