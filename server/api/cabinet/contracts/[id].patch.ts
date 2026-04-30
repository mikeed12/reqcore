import { z } from 'zod'
import { and, inArray, eq } from 'drizzle-orm'
import { candidateContract } from '../../../database/schema'
import { requireCabinetAuth } from '../../../utils/cabinet-auth'

const bodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  employerName: z.string().min(1).max(200).optional(),
  contractType: z.enum(['employment', 'freelance', 'consulting', 'service', 'nda', 'other']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  salary: z.string().max(100).optional().nullable(),
  currency: z.string().max(10).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, bodySchema.parse)

  // Ensure this contract belongs to the authenticated candidate
  const existing = await db
    .select({ id: candidateContract.id })
    .from(candidateContract)
    .where(and(
      eq(candidateContract.id, id),
      inArray(candidateContract.candidateId, candidateIds),
    ))
    .limit(1)

  if (!existing[0]) throw createError({ statusCode: 404, statusMessage: 'Contract not found' })

  const now = new Date()
  const updates: Partial<typeof candidateContract.$inferInsert> = { updatedAt: now }

  if (body.title !== undefined)        updates.title        = body.title.trim()
  if (body.employerName !== undefined) updates.employerName = body.employerName.trim()
  if (body.contractType !== undefined) updates.contractType = body.contractType
  if ('startDate' in body)             updates.startDate    = body.startDate ?? null
  if ('endDate' in body)               updates.endDate      = body.endDate ?? null
  if ('salary' in body)                updates.salary       = body.salary?.trim() ?? null
  if ('currency' in body)              updates.currency     = body.currency?.trim() ?? null
  if ('notes' in body)                 updates.notes        = body.notes?.trim() ?? null

  await db
    .update(candidateContract)
    .set(updates)
    .where(eq(candidateContract.id, id))

  const [row] = await db.select().from(candidateContract).where(eq(candidateContract.id, id)).limit(1)
  return row
})
