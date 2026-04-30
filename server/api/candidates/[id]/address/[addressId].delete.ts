import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { address } from '../../../../database/schema'
import { candidateIdParamSchema } from '../../../../utils/schemas/candidate'

const paramsSchema = candidateIdParamSchema.extend({
  addressId: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { candidate: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id, addressId } = await getValidatedRouterParams(event, paramsSchema.parse)

  const [deleted] = await db.delete(address)
    .where(and(
      eq(address.id, addressId),
      eq(address.candidateId, id),
      eq(address.organizationId, orgId),
    ))
    .returning({ id: address.id })

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  setResponseStatus(event, 204)
  return null
})
