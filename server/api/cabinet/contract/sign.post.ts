import { z } from 'zod'
import { and, inArray, sql, eq } from 'drizzle-orm'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { candidate, document } from '../../../database/schema'
import { requireCabinetAuth } from '../../../utils/cabinet-auth'

const bodySchema = z.object({
  signatureDataUrl: z.string().startsWith('data:image/png;base64,'),
})

// ─── Contract template ───────────────────────────────────────────────────────

function buildContractText(candidateName: string, date: string): string[] {
  return [
    'EMPLOYMENT CONTRACT',
    '',
    `This Employment Contract ("Agreement") is entered into as of ${date}`,
    `between the Employer and ${candidateName} ("Candidate").`,
    '',
    '1. POSITION AND DUTIES',
    'The Candidate agrees to perform the duties and responsibilities associated',
    'with the position as outlined during the recruitment process.',
    '',
    '2. COMMENCEMENT',
    'The employment shall commence on the date agreed upon by both parties.',
    '',
    '3. COMPENSATION',
    'Compensation details, including salary and benefits, will be confirmed',
    'in a separate offer letter provided by the Employer.',
    '',
    '4. CONFIDENTIALITY',
    'The Candidate agrees to keep confidential all proprietary information,',
    'trade secrets, and business data of the Employer during and after',
    'the period of employment.',
    '',
    '5. TERMINATION',
    'Either party may terminate this Agreement with reasonable notice as',
    'required by applicable law.',
    '',
    '6. GOVERNING LAW',
    'This Agreement shall be governed by the applicable laws of the',
    'jurisdiction in which the Employer operates.',
    '',
    '─────────────────────────────────────────────',
    '',
    'By signing below, the Candidate confirms they have read, understood,',
    'and agreed to the terms set out in this Agreement.',
    '',
    `Candidate: ${candidateName}`,
    `Date: ${date}`,
    '',
    'Signature:',
  ]
}

// ─────────────────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  // ── 1. Resolve candidate & org ───────────────────────────────────────────
  const candidateRow = await db.query.candidate.findFirst({
    where: inArray(candidate.id, candidateIds),
    columns: { id: true, organizationId: true, firstName: true, lastName: true, email: true },
  })
  if (!candidateRow) throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })

  const { id: candidateId, organizationId, firstName, lastName } = candidateRow
  const candidateName = `${firstName} ${lastName}`.trim()
  const signedAt = new Date()
  const dateStr = signedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  // ── 2. Delete any existing signed contract ───────────────────────────────
  const existing = await db
    .select({ id: document.id, storageKey: document.storageKey })
    .from(document)
    .where(and(
      inArray(document.candidateId, candidateIds),
      sql`${document.parsedContent}->>'contractType' = 'signed_contract'`,
    ))
    .limit(1)

  if (existing[0]) {
    await db.delete(document).where(eq(document.id, existing[0].id))
    try { await deleteFromS3(existing[0].storageKey) } catch {}
  }

  // ── 3. Build PDF ─────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const page = pdfDoc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()
  const margin = 60
  const lineHeight = 16
  let y = height - margin

  const drawText = (text: string, opts: { bold?: boolean; size?: number; color?: [number, number, number] } = {}) => {
    const size = opts.size ?? 11
    const selectedFont = opts.bold ? fontBold : font
    const [r, g, b] = opts.color ?? [0.1, 0.1, 0.1]
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: selectedFont,
      color: rgb(r, g, b),
      maxWidth: width - margin * 2,
    })
    y -= lineHeight
  }

  const contractLines = buildContractText(candidateName, dateStr)
  for (const line of contractLines) {
    if (y < margin + 140) break // leave room for signature block
    if (line === 'EMPLOYMENT CONTRACT') {
      drawText(line, { bold: true, size: 16, color: [0.08, 0.08, 0.08] })
      y -= 8
    } else if (/^\d+\./.test(line)) {
      drawText(line, { bold: true, size: 11 })
    } else if (line === '─────────────────────────────────────────────') {
      page.drawLine({
        start: { x: margin, y: y + 6 },
        end: { x: width - margin, y: y + 6 },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      })
      y -= lineHeight
    } else {
      drawText(line)
    }
  }

  // ── 4. Embed signature image ─────────────────────────────────────────────
  y -= 8
  const sigY = y - 80

  // Box outline for signature area
  page.drawRectangle({
    x: margin,
    y: sigY,
    width: width - margin * 2,
    height: 80,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  })

  // Decode base64 PNG
  const base64Data = body.signatureDataUrl.replace('data:image/png;base64,', '')
  const sigBytes = Buffer.from(base64Data, 'base64')
  const sigImage = await pdfDoc.embedPng(sigBytes)
  const sigDims = sigImage.scaleToFit(width - margin * 2 - 20, 70)

  page.drawImage(sigImage, {
    x: margin + 10,
    y: sigY + (80 - sigDims.height) / 2,
    width: sigDims.width,
    height: sigDims.height,
  })

  y = sigY - 20

  // Footer metadata
  drawText(`Signed electronically by ${candidateName} on ${dateStr}`, { size: 9, color: [0.5, 0.5, 0.5] })
  drawText(`Email: ${candidateRow.email}`, { size: 9, color: [0.5, 0.5, 0.5] })
  drawText('This document was signed via the Reqcore candidate portal.', { size: 9, color: [0.5, 0.5, 0.5] })

  const pdfBytes = await pdfDoc.save()

  // ── 5. Upload PDF to S3 ──────────────────────────────────────────────────
  const documentId = crypto.randomUUID()
  const storageKey = `contracts/${candidateId}/${documentId}.pdf`
  await uploadToS3(storageKey, Buffer.from(pdfBytes), 'application/pdf')

  // ── 6. Save document record ──────────────────────────────────────────────
  const filename = `contract-signed-${dateStr.replace(/\s/g, '-').toLowerCase()}.pdf`
  const now = new Date()

  await db.insert(document).values({
    id: documentId,
    organizationId,
    candidateId,
    type: 'other',
    storageKey,
    originalFilename: filename,
    mimeType: 'application/pdf',
    sizeBytes: pdfBytes.length,
    parsedContent: {
      contractType: 'signed_contract',
      signedAt: signedAt.toISOString(),
      candidateName,
    } as any,
    createdAt: now,
  })

  return { ok: true, documentId, filename, signedAt: signedAt.toISOString() }
})
