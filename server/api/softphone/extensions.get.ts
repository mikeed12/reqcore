/**
 * GET /api/softphone/extensions
 * Returns SIP extensions assigned to the current user, with decrypted credentials
 * in a JsSIP-compatible shape.
 */
import { decrypt } from '../../utils/encryption'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId  = session.session.activeOrganizationId
  const userId = session.user.id
  const secret = env.BETTER_AUTH_SECRET

  let assignments: Awaited<ReturnType<typeof db.query.memberSipExtensionAssignment.findMany>>
  try {
    assignments = await db.query.memberSipExtensionAssignment.findMany({
      where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.organizationId, orgId)),
      with: { sipExtension: true },
      orderBy: (t, { desc, asc }) => [desc(t.isPrimary), asc(t.assignedAt)],
    })
  } catch {
    // Table doesn't exist yet (migration pending) — return empty list
    return { data: [] }
  }

  const data = assignments
    .map(a => a.sipExtension)
    .filter(ext => ext.isActive)
    .map(ext => {
      const sipUser = ext.usernameEncrypted
        ? decrypt(ext.usernameEncrypted, secret)
        : ext.extension
      const sipPassword = ext.passwordEncrypted
        ? decrypt(ext.passwordEncrypted, secret)
        : null

      return {
        id:          ext.id,
        name:        ext.label,
        number:      ext.extension,
        displayName: ext.displayName || ext.label,
        // JsSIP config fields
        sipUser,
        sipPassword,
        sipHost:     ext.domain || null,
        sipPort:     ext.wsPort || '8089',
        sipPathname: ext.wsPath || '/ws',
      }
    })

  return { data }
})
