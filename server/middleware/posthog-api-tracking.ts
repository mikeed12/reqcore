/**
 * Server middleware: captures API request outcomes to PostHog as both events
 * and structured OpenTelemetry logs (PostHog Logs).
 *
 * - Emits a structured log for every API request (wide event pattern)
 * - Tracks 4xx/5xx responses as 'api error' PostHog events
 * - Tracks requests slower than 3s as 'api slow_request' events
 * - Skips static assets and non-API routes
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Only track API routes — skip static assets, ingest proxy, etc.
  if (!path.startsWith('/api/')) return

  const start = Date.now()

  event.node.res.on('finish', () => {
    try {
      const duration = Date.now() - start
      const statusCode = event.node.res.statusCode
      const method = getMethod(event)
      const headers = getHeaders(event)

      // ── PostHog Logs: structured wide event per API request ──
      const isError = statusCode >= 400
      const isSlow = duration > 3000

      const logAttrs: Record<string, unknown> = {
        http_method: method,
        http_path: path,
        http_status: statusCode,
        duration_ms: duration,
        user_agent: headers['user-agent'],
      }

      if (isSlow) logAttrs.slow_request = true

      if (isError) {
        logError(`${method} ${path} ${statusCode}`, logAttrs)
      }
      else if (isSlow) {
        logWarn(`${method} ${path} slow ${duration}ms`, logAttrs)
      }
      else {
        logInfo(`${method} ${path} ${statusCode}`, logAttrs)
      }

      // ── PostHog Events: error/slow tracking (existing behaviour) ──
      if (isError) {
        trackApiError(event, statusCode, { duration_ms: duration })
      }
      if (isSlow) {
        trackApiError(event, statusCode, {
          duration_ms: duration,
          slow_request: true,
        })
      }
    }
    catch {
      // Tracking must never break the response
    }
  })
})
