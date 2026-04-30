/**
 * DELETE /api/sip-extensions/:id/assignments/:userId
 * Removes a member assignment from a SIP extension.
 */
import { eq, and } from 'drizzle-orm'
import { memberSipExtensionAssignment } from '../../../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const extensionId = getRouterParam(event, 'id')!
  const userId = getRouterParam(event, 'userId')!

  const [deleted] = await db
    .delete(memberSipExtensionAssignment)
    .where(and(
      eq(memberSipExtensionAssignment.organizationSipExtensionId, extensionId),
      eq(memberSipExtensionAssignment.userId, userId),
      eq(memberSipExtensionAssignment.organizationId, orgId),
    ))
    .returning({ id: memberSipExtensionAssignment.id })

  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Assignment not found' })

  return { ok: true }
})
