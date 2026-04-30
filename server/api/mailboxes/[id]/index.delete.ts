import { eq, and } from 'drizzle-orm'
import { organizationMailbox } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { organization: ['update'] })
  const orgId = session.session.activeOrganizationId
  const id = getRouterParam(event, 'id')!

  const [deleted] = await db
    .delete(organizationMailbox)
    .where(and(eq(organizationMailbox.id, id), eq(organizationMailbox.organizationId, orgId)))
    .returning({ id: organizationMailbox.id })

  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Mailbox not found' })
  return { ok: true }
})
