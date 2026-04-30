/**
 * Suppress Vue Router "No match found" warnings for server-only paths
 * (WebSocket upgrade endpoint, PostHog ingest proxy, etc.) that are handled
 * by Nitro before the client router ever sees them.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  router.onError(() => {}) // no-op: prevent unhandled router errors bubbling
  router.afterEach((_to, _from, failure) => {
    if (failure?.message?.includes('/_ws/') || failure?.message?.includes('/ingest/')) {
      // swallow — Nitro handles these, Vue Router doesn't need to match them
    }
  })
})
