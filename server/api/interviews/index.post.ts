import { and, eq } from 'drizzle-orm'
import { interview, application } from '../../database/schema'
import { createInterviewSchema } from '../../utils/schemas/interview'

export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { interview: ['create'] })
  const orgId = session.session.activeOrganizationId

  const body = await readValidatedBody(event, createInterviewSchema.parse)

  // Verify the application exists and belongs to this org
  const app = await db.query.application.findFirst({
    where: and(
      eq(application.id, body.applicationId),
      eq(application.organizationId, orgId),
    ),
    columns: { id: true, status: true },
  })

  if (!app) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Application not found',
    })
  }

  const [created] = await db.insert(interview).values({
    organizationId: orgId,
    applicationId: body.applicationId,
    title: body.title,
    type: body.type,
    scheduledAt: new Date(body.scheduledAt),
    duration: body.duration,
    location: body.location ?? null,
    notes: body.notes ?? null,
    interviewers: body.interviewers ?? null,
    createdById: session.user.id,
  }).returning()

  if (!created) throw createError({ statusCode: 500, statusMessage: 'Failed to create interview' })

  recordActivity({
    organizationId: orgId,
    actorId: session.user.id,
    action: 'created',
    resourceType: 'interview',
    resourceId: created.id,
    metadata: {
      applicationId: body.applicationId,
      title: body.title,
      scheduledAt: body.scheduledAt,
    },
  })

  setResponseStatus(event, 201)
  return created
})
