import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { candidate } from '../../../database/schema'
import { consumeMagicToken, createCabinetSession } from '../../../utils/cabinet-auth'

const bodySchema = z.object({
  token: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)

  const email = await consumeMagicToken(body.token)
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired token' })
  }

  const candidates = await db
    .select({ id: candidate.id })
    .from(candidate)
    .where(eq(candidate.email, email))

  if (candidates.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No candidate found for this email' })
  }

  const candidateIds = candidates.map(c => c.id)
  await createCabinetSession(event, candidateIds)

  return { ok: true }
})
