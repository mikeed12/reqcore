import { eq, and } from 'drizzle-orm'
import { candidate, organization } from '../../../database/schema'
import { candidateIdParamSchema } from '../../../utils/schemas/candidate'
import { sendAddressRequestEmail } from '../../../utils/email'

export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { candidate: ['update'] })
  const orgId = session.session.activeOrganizationId

  const { id } = await getValidatedRouterParams(event, candidateIdParamSchema.parse)

  const [candidateRecord, org] = await Promise.all([
    db.query.candidate.findFirst({
      where: and(eq(candidate.id, id), eq(candidate.organizationId, orgId)),
      columns: { id: true, firstName: true, lastName: true, email: true },
    }),
    db.query.organization.findFirst({
      where: eq(organization.id, orgId),
      columns: { name: true },
    }),
  ])

  if (!candidateRecord || !org) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  if (!env.RESEND_FROM_EMAIL && env.RESEND_API_KEY) {
    throw createError({ statusCode: 503, statusMessage: 'Email sending is not configured (RESEND_FROM_EMAIL missing)' })
  }

  const baseUrl = env.BETTER_AUTH_URL
    || (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : '')
    || 'https://reqcore.com'

  const verificationUrl = `${baseUrl}/candidates/address-verification/${candidateRecord.id}`
  const candidateName = `${candidateRecord.firstName} ${candidateRecord.lastName}`
  const senderName = session.user.name || session.user.email

  await sendAddressRequestEmail({
    candidateName,
    candidateEmail: candidateRecord.email,
    organizationName: org.name,
    senderName,
    verificationUrl,
  })

  recordActivity({
    organizationId: orgId,
    actorId: session.user.id,
    action: 'updated',
    resourceType: 'candidate',
    resourceId: id,
    metadata: { action: 'address_request_sent', candidateEmail: candidateRecord.email },
  })

  return { success: true, sentTo: candidateRecord.email }
})
