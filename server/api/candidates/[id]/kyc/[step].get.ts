import { eq, and, sql } from 'drizzle-orm'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { candidate, document } from '../../../../database/schema'

const VALID_STEPS = new Set(['front', 'back', 'selfie'])

export default defineEventHandler(async (event) => {
  const session = await requirePermission(event, { document: ['read'] })
  const orgId = session.session.activeOrganizationId

  const candidateId = getRouterParam(event, 'id')
  const step = getRouterParam(event, 'step')

  if (!candidateId) throw createError({ statusCode: 400, statusMessage: 'Missing candidate ID' })
  if (!step || !VALID_STEPS.has(step)) throw createError({ statusCode: 400, statusMessage: 'Invalid step' })

  // Verify candidate belongs to this org
  const exists = await db.query.candidate.findFirst({
    where: and(eq(candidate.id, candidateId), eq(candidate.organizationId, orgId)),
    columns: { id: true },
  })
  if (!exists) throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })

  const doc = await db.query.document.findFirst({
    where: and(
      eq(document.candidateId, candidateId),
      eq(document.organizationId, orgId),
      sql`${document.parsedContent}->>'kycStep' = ${step}`,
    ),
    columns: { storageKey: true, mimeType: true },
  })

  if (!doc) throw createError({ statusCode: 404, statusMessage: 'KYC image not found' })

  const s3Response = await getS3Client().send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: doc.storageKey }),
  )

  if (!s3Response.Body) throw createError({ statusCode: 500, statusMessage: 'Failed to retrieve image' })

  const headers: Record<string, string> = {
    'Content-Type': doc.mimeType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }
  if (s3Response.ContentLength) headers['Content-Length'] = String(s3Response.ContentLength)

  setResponseHeaders(event, headers)
  return s3Response.Body.transformToWebStream()
})
