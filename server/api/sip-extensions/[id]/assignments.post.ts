/**
 * POST /api/sip-extensions/:id/assignments
 * Assigns a member to a SIP extension.
 */
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { organizationSipExtension, memberSipExtensionAssignment } from '../../../database/schema'
import { user } from '../../../database/schema/auth'

const bodySchema = z.object({
  userId:    z.string(),
  isPrimary: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId = session.session.activeOrganizationId
  const extensionId = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, bodySchema.parse)

  // Verify extension belongs to org
  const ext = await db.query.organizationSipExtension.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, extensionId), eq(t.organizationId, orgId)),
  })
  if (!ext) throw createError({ statusCode: 404, statusMessage: 'Extension not found' })

  const [assignment] = await db
    .insert(memberSipExtensionAssignment)
    .values({
      organizationSipExtensionId: extensionId,
      userId:                     body.userId,
      organizationId:             orgId,
      isPrimary:                  body.isPrimary ?? false,
    })
    .onConflictDoUpdate({
      target: [memberSipExtensionAssignment.userId, memberSipExtensionAssignment.organizationSipExtensionId],
      set: { isPrimary: body.isPrimary ?? false },
    })
    .returning()

  return assignment
})
