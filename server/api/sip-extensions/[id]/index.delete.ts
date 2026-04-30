/**
 * DELETE /api/sip-extensions/:id
 * Deletes a SIP extension (and cascades to assignments).
 */
import { eq, and } from 'drizzle-orm'
import { organizationSipExtension } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const id = getRouterParam(event, 'id')!

  const [deleted] = await db
    .delete(organizationSipExtension)
    .where(and(
      eq(organizationSipExtension.id, id),
      eq(organizationSipExtension.organizationId, orgId),
    ))
    .returning({ id: organizationSipExtension.id })

  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Extension not found' })

  return { ok: true }
})
