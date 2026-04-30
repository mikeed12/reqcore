import { eq, and, gt } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { verification } from '../database/schema'

const MAGIC_TTL_MS = 15 * 60 * 1000       // 15 minutes
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const COOKIE_NAME = 'cabinet_session'

const MAGIC_PREFIX = 'cabinet-magic:'
const SESSION_PREFIX = 'cabinet-session:'

// ─────────────────────────────────────────────
// Token helpers
// ─────────────────────────────────────────────

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─────────────────────────────────────────────
// Magic link
// ─────────────────────────────────────────────

/**
 * Generate a magic link token for the given email and persist it.
 * Overwrites any existing token for that email (one token at a time).
 */
export async function createMagicToken(email: string): Promise<string> {
  const token = generateToken()
  const identifier = MAGIC_PREFIX + email.toLowerCase()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + MAGIC_TTL_MS)

  // Upsert: delete old + insert new (verification table has no unique index on identifier)
  await db.delete(verification).where(eq(verification.identifier, identifier))
  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier,
    value: token,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  })

  return token
}

/**
 * Validate a magic token. Returns the email it belongs to, or null if invalid/expired.
 * Consumes the token on success (single-use).
 */
export async function consumeMagicToken(token: string): Promise<string | null> {
  const now = new Date()

  const rows = await db
    .select()
    .from(verification)
    .where(
      and(
        eq(verification.value, token),
        gt(verification.expiresAt, now),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row || !row.identifier.startsWith(MAGIC_PREFIX)) return null

  await db.delete(verification).where(eq(verification.id, row.id))

  return row.identifier.slice(MAGIC_PREFIX.length)
}

// ─────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────

/**
 * Create a cabinet session for the given candidate IDs and set the session cookie.
 * `candidateIds` is stored as a JSON array so one email ↔ multiple org candidates
 * can share a single session.
 */
export async function createCabinetSession(
  event: H3Event,
  candidateIds: string[],
): Promise<void> {
  const sessionToken = generateToken()
  const identifier = SESSION_PREFIX + sessionToken
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier,
    value: JSON.stringify(candidateIds),
    expiresAt,
    createdAt: now,
    updatedAt: now,
  })

  setCookie(event, COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
}

/**
 * Resolve the current cabinet session from the request cookie.
 * Returns the list of candidate IDs, or null if the session is absent/expired.
 */
export async function getCabinetSession(event: H3Event): Promise<string[] | null> {
  const sessionToken = getCookie(event, COOKIE_NAME)
  if (!sessionToken) return null

  const identifier = SESSION_PREFIX + sessionToken
  const now = new Date()

  const rows = await db
    .select()
    .from(verification)
    .where(
      and(
        eq(verification.identifier, identifier),
        gt(verification.expiresAt, now),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) return null

  try {
    return JSON.parse(row.value) as string[]
  }
  catch {
    return null
  }
}

/**
 * Resolve a cabinet session directly from a raw session token string.
 * Used by the WebSocket handler which receives a raw Request (not H3Event).
 */
export async function getCabinetSessionFromToken(token: string): Promise<string[] | null> {
  const identifier = SESSION_PREFIX + token
  const now = new Date()

  const rows = await db
    .select()
    .from(verification)
    .where(
      and(
        eq(verification.identifier, identifier),
        gt(verification.expiresAt, now),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) return null

  try {
    return JSON.parse(row.value) as string[]
  }
  catch {
    return null
  }
}

/**
 * Require a valid cabinet session. Throws 401 if absent/expired.
 * Returns the matching candidate rows.
 */
export async function requireCabinetAuth(event: H3Event) {
  const candidateIds = await getCabinetSession(event)
  if (!candidateIds || candidateIds.length === 0) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return candidateIds
}

/**
 * Delete the current cabinet session cookie and remove it from the DB.
 */
export async function destroyCabinetSession(event: H3Event): Promise<void> {
  const sessionToken = getCookie(event, COOKIE_NAME)
  if (sessionToken) {
    const identifier = SESSION_PREFIX + sessionToken
    await db.delete(verification).where(eq(verification.identifier, identifier))
  }

  deleteCookie(event, COOKIE_NAME, { path: '/' })
}
