/**
 * Composable for privacy-respecting PostHog funnel tracking.
 *
 * Wraps posthog.capture() with:
 * - Consent gating (no-ops when user hasn't opted in)
 * - Auto-enrichment with page context (route path, viewport width)
 */
import type { PostHog } from 'posthog-js'

function getPostHog(): PostHog | undefined {
  const $ph = (useNuxtApp() as Record<string, unknown>).$posthog as (() => PostHog) | undefined
  return $ph?.()
}

export function useTrack() {
  const route = useRoute()

  /**
   * Send a custom event to PostHog (consent-gated).
   * Automatically includes current route path and viewport width.
   */
  function track(eventName: string, properties?: Record<string, unknown>) {
    if (!import.meta.client) return
    const ph = getPostHog()
    if (!ph || !ph.has_opted_in_capturing()) return

    ph.capture(eventName, {
      path: route.path,
      viewport_width: window.innerWidth,
      ...properties,
    })
  }

  return { track }
}
