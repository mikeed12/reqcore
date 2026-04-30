/**
 * SMTP helper using nodemailer.
 * Builds a transporter from an organizationMailbox row and sends mail.
 */
import nodemailer from 'nodemailer'
import { organizationMailbox } from '../database/schema'
import { decrypt } from './encryption'

export interface SendMailOptions {
  to: string | string[]
  cc?: string | string[]
  subject: string
  text?: string
  html?: string
  inReplyTo?: string   // Message-ID of the message being replied to
  references?: string  // Space-separated Message-IDs chain
}

export async function buildSmtpTransport(
  mailboxRow: typeof organizationMailbox.$inferSelect,
) {
  const secret = env.BETTER_AUTH_SECRET

  if (mailboxRow.provider === 'gmail') {
    const accessToken = mailboxRow.accessTokenEncrypted
      ? decrypt(mailboxRow.accessTokenEncrypted, secret)
      : null
    if (!accessToken) throw new Error('Gmail mailbox has no OAuth2 token')
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: mailboxRow.email,
        accessToken,
      },
    })
  }

  if (mailboxRow.provider === 'microsoft') {
    const accessToken = mailboxRow.accessTokenEncrypted
      ? decrypt(mailboxRow.accessTokenEncrypted, secret)
      : null
    if (!accessToken) throw new Error('Microsoft mailbox has no OAuth2 token')
    return nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        type: 'OAuth2',
        user: mailboxRow.email,
        accessToken,
      },
    })
  }

  // Generic IMAP/SMTP password auth
  if (!mailboxRow.smtpHost) throw new Error('SMTP host not configured for this mailbox')
  const password = mailboxRow.passwordEncrypted
    ? decrypt(mailboxRow.passwordEncrypted, secret)
    : null
  const username = mailboxRow.usernameEncrypted
    ? decrypt(mailboxRow.usernameEncrypted, secret)
    : mailboxRow.email

  return nodemailer.createTransport({
    host:   mailboxRow.smtpHost,
    port:   mailboxRow.smtpPort ?? 587,
    secure: mailboxRow.smtpTls ?? false,
    auth:   { user: username!, pass: password! },
  })
}

export async function sendMail(
  mailboxRow: typeof organizationMailbox.$inferSelect,
  options: SendMailOptions,
) {
  const transporter = await buildSmtpTransport(mailboxRow)
  const fromName = mailboxRow.label || mailboxRow.email

  await transporter.sendMail({
    from:       `"${fromName}" <${mailboxRow.email}>`,
    to:         Array.isArray(options.to) ? options.to.join(', ') : options.to,
    cc:         options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
    subject:    options.subject,
    text:       options.text,
    html:       options.html,
    inReplyTo:  options.inReplyTo,
    references: options.references,
  })
}
