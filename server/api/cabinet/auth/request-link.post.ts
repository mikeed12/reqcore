import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { candidate } from '../../../database/schema'
import { createMagicToken } from '../../../utils/cabinet-auth'
import { sendCabinetMagicLinkEmail } from '../../../utils/email'

const bodySchema = z.object({
  email: z.string().email(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const email = body.email.toLowerCase().trim()

  // Look up candidates with this email across all orgs
  const candidates = await db
    .select({ id: candidate.id })
    .from(candidate)
    .where(eq(candidate.email, email))

  // Always respond with success to prevent email enumeration
  if (candidates.length === 0) {
    return { ok: true }
  }

  const token = await createMagicToken(email)

  const baseUrl = env.BETTER_AUTH_URL
    ?? (env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${env.RAILWAY_PUBLIC_DOMAIN}`
      : 'http://localhost:3000')

  const url = `${baseUrl}/cabinet/auth/verify?token=${token}`

  await sendCabinetMagicLinkEmail({ email, url })

  return { ok: true }
})
