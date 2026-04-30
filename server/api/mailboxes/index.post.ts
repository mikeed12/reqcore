import { z } from 'zod'
import { organizationMailbox } from '../../database/schema'
import { encrypt } from '../../utils/encryption'

const bodySchema = z.object({
  label:    z.string().min(1).max(100),
  email:    z.string().email(),
  provider: z.enum(['imap', 'gmail', 'microsoft']).default('imap'),
  imapHost: z.string().optional(),
  imapPort: z.number().int().optional(),
  imapTls:  z.boolean().default(true),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpTls:  z.boolean().default(true),
  username: z.string().optional(),
  password: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { organization: ['update'] })
  const orgId = session.session.activeOrganizationId
  const body = await readValidatedBody(event, bodySchema.parse)
  const secret = env.BETTER_AUTH_SECRET

  const [mailbox] = await db.insert(organizationMailbox).values({
    organizationId:    orgId,
    label:             body.label,
    email:             body.email,
    provider:          body.provider,
    imapHost:          body.imapHost ?? null,
    imapPort:          body.imapPort ?? null,
    imapTls:           body.imapTls,
    smtpHost:          body.smtpHost ?? null,
    smtpPort:          body.smtpPort ?? null,
    smtpTls:           body.smtpTls,
    usernameEncrypted: body.username ? encrypt(body.username, secret) : null,
    passwordEncrypted: body.password ? encrypt(body.password, secret) : null,
  }).returning()

  const { usernameEncrypted, passwordEncrypted, accessTokenEncrypted, refreshTokenEncrypted, ...safe } = mailbox
  return { ...safe, hasPassword: !!passwordEncrypted, hasOAuthToken: false, assignments: [] }
})
