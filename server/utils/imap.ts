/**
 * IMAP connection helper using imapflow.
 * Connects to a mailbox, fetches recent messages, stores them in mail_message table.
 */
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { eq } from 'drizzle-orm'
import { organizationMailbox, mailMessage } from '../database/schema'
import { decrypt } from './encryption'

export async function buildImapClient(mailbox: typeof organizationMailbox.$inferSelect) {
  const secret = env.BETTER_AUTH_SECRET

  if (mailbox.provider === 'gmail') {
    // OAuth2 XOAUTH2 — access token must be fresh
    const accessToken = mailbox.accessTokenEncrypted
      ? decrypt(mailbox.accessTokenEncrypted, secret)
      : null
    if (!accessToken) throw new Error('Gmail mailbox has no OAuth2 token')
    return new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: mailbox.email, accessToken },
      logger: false,
    })
  }

  if (mailbox.provider === 'microsoft') {
    const accessToken = mailbox.accessTokenEncrypted
      ? decrypt(mailbox.accessTokenEncrypted, secret)
      : null
    if (!accessToken) throw new Error('Microsoft mailbox has no OAuth2 token')
    return new ImapFlow({
      host: 'outlook.office365.com',
      port: 993,
      secure: true,
      auth: { user: mailbox.email, accessToken },
      logger: false,
    })
  }

  // IMAP password auth
  if (!mailbox.imapHost) throw new Error('IMAP host not configured')
  const password = mailbox.passwordEncrypted ? decrypt(mailbox.passwordEncrypted, secret) : null
  const username = mailbox.usernameEncrypted
    ? decrypt(mailbox.usernameEncrypted, secret)
    : mailbox.email

  return new ImapFlow({
    host:   mailbox.imapHost,
    port:   mailbox.imapPort ?? 993,
    secure: mailbox.imapTls ?? true,
    auth:   { user: username!, pass: password! },
    logger: false,
  })
}

/**
 * Sync the most recent `limit` messages from a mailbox folder into mail_message.
 * Returns the number of new messages inserted.
 */
export async function syncMailbox(
  mailboxRow: typeof organizationMailbox.$inferSelect,
  folder = 'INBOX',
  limit = 50,
): Promise<{ synced: number; error?: string }> {
  const client = await buildImapClient(mailboxRow)

  try {
    await client.connect()
    const lock = await client.getMailboxLock(folder)
    let synced = 0

    try {
      // Fetch the most recent `limit` messages
      const total = client.mailbox?.exists ?? 0
      if (total === 0) return { synced: 0 }

      const start = Math.max(1, total - limit + 1)
      const range = `${start}:*`

      const rows: (typeof mailMessage.$inferInsert)[] = []

      // Single fetch: envelope + raw source — mailparser extracts text/html from source
      for await (const msg of client.fetch(range, {
        uid: true,
        envelope: true,
        source: true,
      })) {
        // Parse the raw RFC822 source to extract text and HTML bodies
        const parsed = await simpleParser(msg.source as Buffer)

        rows.push({
          organizationMailboxId: mailboxRow.id,
          organizationId:        mailboxRow.organizationId,
          uid:       msg.uid,
          folder,
          messageId: msg.envelope.messageId ?? null,
          fromName:  msg.envelope.from?.[0]?.name ?? null,
          fromEmail: msg.envelope.from?.[0]?.address ?? null,
          toJson:    JSON.stringify(msg.envelope.to?.map((a: any) => ({ name: a.name, email: a.address })) ?? []),
          ccJson:    JSON.stringify(msg.envelope.cc?.map((a: any) => ({ name: a.name, email: a.address })) ?? []),
          subject:   msg.envelope.subject ?? null,
          sentAt:    msg.envelope.date ?? null,
          bodyText:  parsed.text ?? null,
          bodyHtml:  parsed.html || null,
        })
      }

      if (rows.length > 0) {
        const result = await db.insert(mailMessage)
          .values(rows)
          .onConflictDoNothing({ target: [mailMessage.organizationMailboxId, mailMessage.folder, mailMessage.uid] })
          .returning({ id: mailMessage.id })
        synced = result.length
      }
    } finally {
      lock.release()
    }

    // Update lastSyncAt and clear any previous error
    await db.update(organizationMailbox)
      .set({ lastSyncAt: new Date(), syncError: null, updatedAt: new Date() })
      .where(eq(organizationMailbox.id, mailboxRow.id))

    return { synced }
  } catch (err: any) {
    console.log(err)
    const errMsg = err?.message ?? 'Unknown IMAP error'
    await db.update(organizationMailbox)
      .set({ syncError: errMsg, updatedAt: new Date() })
      .where(eq(organizationMailbox.id, mailboxRow.id))
    return { synced: 0, error: errMsg }
  } finally {
    await client.logout().catch(() => {})
  }
}
