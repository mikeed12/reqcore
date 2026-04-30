import { eq, and, inArray, sql } from 'drizzle-orm'
import { fileTypeFromBuffer } from 'file-type'
import { candidate, document } from '../../../database/schema'
import { requireCabinetAuth } from '../../../utils/cabinet-auth'
import { sanitizeFilename } from '../../../utils/schemas/document'

const KYC_STEPS = ['front', 'back', 'selfie'] as const
type KycStep = typeof KYC_STEPS[number]

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_SIZE = 10 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'No form data received' })
  }

  const filePart = formData.find(p => p.name === 'file')
  const stepPart = formData.find(p => p.name === 'step')

  if (!filePart?.data || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  }

  const step = stepPart?.data?.toString() as KycStep
  if (!KYC_STEPS.includes(step)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid step. Must be: front, back, or selfie' })
  }

  const fileBuffer = filePart.data
  if (fileBuffer.length > MAX_SIZE) {
    throw createError({ statusCode: 413, statusMessage: 'File too large. Maximum size is 10 MB' })
  }

  const detected = await fileTypeFromBuffer(fileBuffer)
  const mimeType = detected?.mime
  if (!mimeType || !(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file type. Allowed: JPEG, PNG, WebP' })
  }

  const candidateRow = await db.query.candidate.findFirst({
    where: inArray(candidate.id, candidateIds),
    columns: { id: true, organizationId: true },
  })

  if (!candidateRow) {
    throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })
  }

  const { id: candidateId, organizationId } = candidateRow
  const ext = MIME_TO_EXT[mimeType] ?? 'jpg'
  const storageKey = `kyc/${candidateId}/kyc-${step}.${ext}`

  await uploadToS3(storageKey, fileBuffer, mimeType)

  // Replace any previous document for this step (query by kycStep in parsedContent)
  const existing = await db
    .select({ id: document.id, storageKey: document.storageKey })
    .from(document)
    .where(
      and(
        eq(document.candidateId, candidateId),
        sql`${document.parsedContent}->>'kycStep' = ${step}`,
      ),
    )
    .limit(1)

  if (existing[0]) {
    await db.delete(document).where(eq(document.id, existing[0].id))
    // Only remove the old S3 object when the key changed (different extension).
    // If the key is the same, the new upload already overwrote it in-place.
    if (existing[0].storageKey !== storageKey) {
      try { await deleteFromS3(existing[0].storageKey) } catch {}
    }
  }

  const documentId = crypto.randomUUID()
  const now = new Date()

  const [created] = await db.insert(document).values({
    id: documentId,
    organizationId,
    candidateId,
    type: 'other',
    storageKey,
    originalFilename: sanitizeFilename(filePart.filename),
    mimeType,
    sizeBytes: fileBuffer.length,
    parsedContent: { kycStep: step } as any,
    createdAt: now,
  }).returning({
    id: document.id,
    originalFilename: document.originalFilename,
    createdAt: document.createdAt,
  })

  return { ok: true, step, document: created }
})
