import { eq } from 'drizzle-orm'
import * as schema from '../../database/schema'

/**
 * Combined demo-check + sign-out endpoint for the fresh-signup flow.
 *
 * Called when a marketing-site visitor clicks "Use Cloud". Determines
 * whether the existing session belongs to the demo org, and if so,
 * deletes the session server-side and clears the auth cookies so the
 * browser arrives at sign-up with a clean slate.
 *
 * Returns { action: 'signup' | 'dashboard' }.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    return { action: 'signup' }
  }

  const demoSlug = useRuntimeConfig().public.demoOrgSlug as string
  const activeOrgId = (session.session as { activeOrganizationId?: string }).activeOrganizationId

  if (!demoSlug || !activeOrgId) {
    return { action: 'dashboard' }
  }

  const [org] = await db
    .select({ slug: schema.organization.slug })
    .from(schema.organization)
    .where(eq(schema.organization.id, activeOrgId))
    .limit(1)

  if (org?.slug !== demoSlug) {
    return { action: 'dashboard' }
  }

  // ── Demo session — destroy it server-side ──────────────────────
  // 1. Remove the session row from the database
  await db.delete(schema.session).where(eq(schema.session.id, session.session.id))

  // 2. Expire the auth cookies so the browser doesn't keep sending them.
  //    Better Auth prefixes cookie names with __Secure- over HTTPS.
  const isSecure = getRequestURL(event).protocol === 'https:'
  const prefix = isSecure ? '__Secure-better-auth' : 'better-auth'
  const cookieOpts = { path: '/', ...(isSecure && { secure: true }) }

  deleteCookie(event, `${prefix}.session_token`, cookieOpts)
  deleteCookie(event, `${prefix}.session_data`, cookieOpts)

  return { action: 'signup' }
})
