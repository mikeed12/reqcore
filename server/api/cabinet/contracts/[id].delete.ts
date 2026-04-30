import { and, inArray, eq } from 'drizzle-orm'
import { candidateContract } from '../../../database/schema'
import { requireCabinetAuth } from '../../../utils/cabinet-auth'

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)
  const id = getRouterParam(event, 'id')!

  const existing = await db
    .select({ id: candidateContract.id })
    .from(candidateContract)
    .where(and(
      eq(candidateContract.id, id),
      inArray(candidateContract.candidateId, candidateIds),
    ))
    .limit(1)

  if (!existing[0]) throw createError({ statusCode: 404, statusMessage: 'Contract not found' })

  await db.delete(candidateContract).where(eq(candidateContract.id, id))

  return { ok: true }
})
