import { z } from 'zod'
import { inArray, eq } from 'drizzle-orm'
import { candidate, candidateContract } from '../../../database/schema'
import { requireCabinetAuth } from '../../../utils/cabinet-auth'

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  employerName: z.string().min(1).max(200),
  contractType: z.enum(['employment', 'freelance', 'consulting', 'service', 'nda', 'other']).default('employment'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  salary: z.string().max(100).optional().nullable(),
  currency: z.string().max(10).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  // Resolve the primary candidate + org
  const candidateRow = await db.query.candidate.findFirst({
    where: inArray(candidate.id, candidateIds),
    columns: { id: true, organizationId: true },
  })
  if (!candidateRow) throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })

  const now = new Date()
  const id = crypto.randomUUID()

  await db.insert(candidateContract).values({
    id,
    organizationId: candidateRow.organizationId,
    candidateId: candidateRow.id,
    title: body.title.trim(),
    employerName: body.employerName.trim(),
    contractType: body.contractType,
    startDate: body.startDate ?? null,
    endDate: body.endDate ?? null,
    salary: body.salary?.trim() ?? null,
    currency: body.currency?.trim() ?? null,
    notes: body.notes?.trim() ?? null,
    createdAt: now,
    updatedAt: now,
  })

  const [row] = await db.select().from(candidateContract).where(eq(candidateContract.id, id)).limit(1)

  return row
})
