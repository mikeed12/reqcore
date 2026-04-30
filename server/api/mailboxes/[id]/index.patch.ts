import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { organizationMailbox } from '../../../database/schema'
import { encrypt } from '../../../utils/encryption'

const bodySchema = z.object({
  label:    z.string().min(1).max(100).optional(),
  email:    z.string().email().optional(),
  provider: z.enum(['imap', 'gmail', 'microsoft']).optional(),
  imapHost: z.string().nullable().optional(),
  imapPort: z.number().int().nullable().optional(),
  imapTls:  z.boolean().optional(),
  smtpHost: z.string().nullable().optional(),
  smtpPort: z.number().int().nullable().optional(),
  smtpTls:  z.boolean().optional(),
  username: z.string().nullable().optional(),
  // Omitting password = keep existing. Empty string = clear it.
  password: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { organization: ['update'] })
  const orgId = session.session.activeOrganizationId
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, bodySchema.parse)
  const secret = env.BETTER_AUTH_SECRET

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.label    !== undefined) updates.label    = body.label
  if (body.email    !== undefined) updates.email    = body.email
  if (body.provider !== undefined) updates.provider = body.provider
  if (body.imapHost !== undefined) updates.imapHost = body.imapHost
  if (body.imapPort !== undefined) updates.imapPort = body.imapPort
  if (body.imapTls  !== undefined) updates.imapTls  = body.imapTls
  if (body.smtpHost !== undefined) updates.smtpHost = body.smtpHost
  if (body.smtpPort !== undefined) updates.smtpPort = body.smtpPort
  if (body.smtpTls  !== undefined) updates.smtpTls  = body.smtpTls
  if (body.isActive !== undefined) updates.isActive = body.isActive
  if (body.username !== undefined)
    updates.usernameEncrypted = body.username ? encrypt(body.username, secret) : null
  if (body.password !== undefined)
    updates.passwordEncrypted = body.password ? encrypt(body.password, secret) : null

  const [mailbox] = await db
    .update(organizationMailbox)
    .set(updates)
    .where(and(eq(organizationMailbox.id, id), eq(organizationMailbox.organizationId, orgId)))
    .returning()

  if (!mailbox) throw createError({ statusCode: 404, statusMessage: 'Mailbox not found' })

  const { usernameEncrypted, passwordEncrypted, accessTokenEncrypted, refreshTokenEncrypted, ...safe } = mailbox
  return { ...safe, hasPassword: !!passwordEncrypted, hasOAuthToken: !!accessTokenEncrypted }
})
