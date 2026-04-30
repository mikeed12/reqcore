/**
 * POST /api/mail/send
 * Sends an email from one of the user's assigned mailboxes.
 * Body: { mailboxId, to, cc?, subject, text?, html?, inReplyTo?, references? }
 */
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { organizationMailbox, memberMailboxAssignment } from '../../database/schema'
import { sendMail } from '../../utils/smtp'

const bodySchema = z.object({
  mailboxId:  z.string(),
  to:         z.union([z.string().email(), z.array(z.string().email())]),
  cc:         z.union([z.string().email(), z.array(z.string().email())]).optional(),
  subject:    z.string().min(1).max(998),
  text:       z.string().optional(),
  html:       z.string().optional(),
  inReplyTo:  z.string().optional(),
  references: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const orgId  = session.session.activeOrganizationId
  const userId = session.user.id
  const body   = await readValidatedBody(event, bodySchema.parse)

  // Verify user is assigned to this mailbox
  const assignment = await db.query.memberMailboxAssignment.findFirst({
    where: (t, { and, eq }) => and(
      eq(t.userId, userId),
      eq(t.organizationId, orgId),
      eq(t.organizationMailboxId, body.mailboxId),
    ),
  })
  if (!assignment) throw createError({ statusCode: 403, statusMessage: 'Not assigned to this mailbox' })

  const mailbox = await db.query.organizationMailbox.findFirst({
    where: (t, { and, eq }) => and(
      eq(t.id, body.mailboxId),
      eq(t.organizationId, orgId),
      eq(t.isActive, true),
    ),
  })
  if (!mailbox) throw createError({ statusCode: 404, statusMessage: 'Mailbox not found' })

  try {
    await sendMail(mailbox, {
      to:         body.to,
      cc:         body.cc,
      subject:    body.subject,
      text:       body.text,
      html:       body.html,
      inReplyTo:  body.inReplyTo,
      references: body.references,
    })
  } catch (err: any) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to send email: ' + (err?.message ?? 'Unknown SMTP error'),
    })
  }

  return { ok: true }
})
