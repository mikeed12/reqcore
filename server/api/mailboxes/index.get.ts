import { eq } from 'drizzle-orm'
import { organizationMailbox, memberMailboxAssignment } from '../../database/schema'
import { user } from '../../database/schema/auth'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId

  const mailboxes = await db.query.organizationMailbox.findMany({
    where: (t, { eq }) => eq(t.organizationId, orgId),
    orderBy: (t, { asc }) => asc(t.createdAt),
    with: {
      assignments: {
        with: { user: { columns: { id: true, name: true, email: true, image: true } } },
        orderBy: (t, { desc, asc }) => [desc(t.isPrimary), asc(t.assignedAt)],
      },
    },
  })

  // Strip encrypted fields from the response
  return mailboxes.map(({ usernameEncrypted, passwordEncrypted, accessTokenEncrypted, refreshTokenEncrypted, ...m }) => ({
    ...m,
    hasPassword: !!passwordEncrypted,
    hasOAuthToken: !!accessTokenEncrypted,
  }))
})
