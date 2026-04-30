import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { address, candidate } from '../../../database/schema'
import { candidateIdParamSchema } from '../../../utils/schemas/candidate'

const addressSchema = z.object({
  address1: z.string().min(1, 'Address is required').max(255),
  city:     z.string().min(1, 'City is required').max(100),
  state:    z.string().min(1, 'State is required').max(100),
  zip:      z.string().min(1, 'ZIP is required').max(20),
  country:  z.string().min(1).max(100).default('United States'),
})

export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { candidate: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id } = await getValidatedRouterParams(event, candidateIdParamSchema.parse)
  const body = await readValidatedBody(event, addressSchema.parse)

  // Verify candidate belongs to this org
  const exists = await db.query.candidate.findFirst({
    where: and(eq(candidate.id, id), eq(candidate.organizationId, orgId)),
    columns: { id: true },
  })

  if (!exists) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  // Update first existing address or insert a new one
  const existing = await db.query.address.findFirst({
    where: and(eq(address.candidateId, id), eq(address.organizationId, orgId)),
    columns: { id: true },
  })

  let saved
  if (existing) {
    ;[saved] = await db
      .update(address)
      .set(body)
      .where(eq(address.id, existing.id))
      .returning()
  } else {
    ;[saved] = await db
      .insert(address)
      .values({ candidateId: id, organizationId: orgId, ...body })
      .returning()
  }

  return saved
})
