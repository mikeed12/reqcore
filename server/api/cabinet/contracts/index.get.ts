import { inArray } from 'drizzle-orm'
import { candidateContract } from '../../../database/schema'
import { requireCabinetAuth } from '../../../utils/cabinet-auth'

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)

  const rows = await db
    .select()
    .from(candidateContract)
    .where(inArray(candidateContract.candidateId, candidateIds))
    .orderBy(candidateContract.createdAt)

  return rows
})
