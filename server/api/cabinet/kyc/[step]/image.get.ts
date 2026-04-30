import { and, inArray, sql } from 'drizzle-orm'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { document } from '../../../../database/schema'
import { requireCabinetAuth } from '../../../../utils/cabinet-auth'

const VALID_STEPS = new Set(['front', 'back', 'selfie'])

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)

  const step = getRouterParam(event, 'step')
  if (!step || !VALID_STEPS.has(step)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid step' })
  }

  const doc = await db.query.document.findFirst({
    where: and(
      inArray(document.candidateId, candidateIds),
      sql`${document.parsedContent}->>'kycStep' = ${step}`,
    ),
    columns: { storageKey: true, mimeType: true, originalFilename: true },
  })

  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const s3Response = await getS3Client().send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: doc.storageKey }),
  )

  if (!s3Response.Body) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to retrieve image' })
  }

  const headers: Record<string, string> = {
    'Content-Type': doc.mimeType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }
  if (s3Response.ContentLength) {
    headers['Content-Length'] = String(s3Response.ContentLength)
  }

  setResponseHeaders(event, headers)
  return s3Response.Body.transformToWebStream()
})
