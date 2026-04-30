/**
 * POST /api/sip-extensions
 * Creates a new SIP extension for the organization.
 */
import { z } from 'zod'
import { organizationSipExtension } from '../../database/schema'
import { encrypt } from '../../utils/encryption'

const bodySchema = z.object({
  label:       z.string().min(1).max(100),
  extension:   z.string().min(1).max(20),
  displayName: z.string().max(100).optional(),
  username:    z.string().max(200).optional(),
  password:    z.string().max(500).optional(),
  domain:      z.string().max(253).optional(),
  wsPort:      z.string().max(10).optional(),
  wsPath:      z.string().max(100).optional(),
  isActive:    z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const body = await readValidatedBody(event, bodySchema.parse)
  const secret = env.BETTER_AUTH_SECRET

  const [created] = await db
    .insert(organizationSipExtension)
    .values({
      organizationId:    orgId,
      label:             body.label.trim(),
      extension:         body.extension.trim(),
      displayName:       body.displayName?.trim() || null,
      usernameEncrypted: body.username ? encrypt(body.username.trim(), secret) : null,
      passwordEncrypted: body.password ? encrypt(body.password, secret) : null,
      domain:            body.domain?.trim() || null,
      wsPort:            body.wsPort?.trim() || '8089',
      wsPath:            body.wsPath?.trim() || '/ws',
      isActive:          body.isActive ?? true,
    })
    .returning()

  const { usernameEncrypted, passwordEncrypted, ...ext } = created
  return { ...ext, hasPassword: !!passwordEncrypted, assignments: [] }
})
