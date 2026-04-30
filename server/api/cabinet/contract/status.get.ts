import { and, inArray, sql } from 'drizzle-orm'
import { document } from '../../../database/schema'
import { requireCabinetAuth } from '../../../utils/cabinet-auth'

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)

  const docs = await db
    .select({
      id: document.id,
      originalFilename: document.originalFilename,
      createdAt: document.createdAt,
      signedAt: sql<string>`${document.parsedContent}->>'signedAt'`,
      candidateName: sql<string>`${document.parsedContent}->>'candidateName'`,
    })
    .from(document)
    .where(
      and(
        inArray(document.candidateId, candidateIds),
        sql`${document.parsedContent}->>'contractType' = 'signed_contract'`,
      ),
    )
    .limit(1)

  const doc = docs[0]

  if (!doc) {
    return { signed: false }
  }

  return {
    signed: true,
    documentId: doc.id,
    filename: doc.originalFilename,
    signedAt: doc.signedAt,
    candidateName: doc.candidateName,
  }
})
