/**
 * GET /api/sip-extensions
 * Returns all SIP extensions for the current organization with their member assignments.
 */
import { organizationSipExtension } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId

  const extensions = await db.query.organizationSipExtension.findMany({
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
  return extensions.map(({ usernameEncrypted, passwordEncrypted, ...ext }) => ({
    ...ext,
    hasPassword: !!passwordEncrypted,
  }))
})
