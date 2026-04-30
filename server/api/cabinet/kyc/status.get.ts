import { eq, and, inArray, sql } from 'drizzle-orm'
import { candidate, document } from '../../../database/schema'
import { requireCabinetAuth } from '../../../utils/cabinet-auth'

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)

  const docs = await db
    .select({
      id: document.id,
      kycStep: sql<string>`${document.parsedContent}->>'kycStep'`,
      originalFilename: document.originalFilename,
      createdAt: document.createdAt,
    })
    .from(document)
    .where(
      and(
        inArray(document.candidateId, candidateIds),
        sql`${document.parsedContent}->>'kycStep' IN ('front', 'back', 'selfie')`,
      ),
    )

  const byStep = Object.fromEntries(docs.map(d => [d.kycStep, d]))

  const steps = ['front', 'back', 'selfie'] as const
  const allDone = steps.every(s => !!byStep[s])

  return {
    front: byStep.front ? { done: true, documentId: byStep.front.id, filename: byStep.front.originalFilename } : { done: false },
    back: byStep.back ? { done: true, documentId: byStep.back.id, filename: byStep.back.originalFilename } : { done: false },
    selfie: byStep.selfie ? { done: true, documentId: byStep.selfie.id, filename: byStep.selfie.originalFilename } : { done: false },
    allDone,
  }
})
