/**
 * PATCH /api/sip-extensions/:id
 * Updates a SIP extension.
 */
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { organizationSipExtension } from '../../../database/schema'
import { encrypt } from '../../../utils/encryption'

const bodySchema = z.object({
  label:       z.string().min(1).max(100).optional(),
  extension:   z.string().min(1).max(20).optional(),
  displayName: z.string().max(100).optional().nullable(),
  username:    z.string().max(200).optional(),
  password:    z.string().max(500).optional(),
  domain:      z.string().max(253).optional().nullable(),
  wsPort:      z.string().max(10).optional(),
  wsPath:      z.string().max(100).optional(),
  isActive:    z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, bodySchema.parse)
  const secret = env.BETTER_AUTH_SECRET

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.label !== undefined)       updates.label       = body.label.trim()
  if (body.extension !== undefined)   updates.extension   = body.extension.trim()
  if (body.displayName !== undefined) updates.displayName = body.displayName?.trim() || null
  if (body.domain !== undefined)      updates.domain      = body.domain?.trim() || null
  if (body.wsPort !== undefined)      updates.wsPort      = body.wsPort.trim()
  if (body.wsPath !== undefined)      updates.wsPath      = body.wsPath.trim()
  if (body.isActive !== undefined)    updates.isActive    = body.isActive
  if (body.username !== undefined)    updates.usernameEncrypted = body.username.trim() ? encrypt(body.username.trim(), secret) : null
  if (body.password !== undefined && body.password)
    updates.passwordEncrypted = encrypt(body.password, secret)

  const [updated] = await db
    .update(organizationSipExtension)
    .set(updates)
    .where(and(
      eq(organizationSipExtension.id, id),
      eq(organizationSipExtension.organizationId, orgId),
    ))
    .returning()

  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Extension not found' })

  const { usernameEncrypted, passwordEncrypted, ...ext } = updated
  return { ...ext, hasPassword: !!passwordEncrypted }
})
