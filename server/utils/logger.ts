import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { resourceFromAttributes } from '@opentelemetry/resources'
import type { H3Event } from 'h3'

let loggerProvider: LoggerProvider | null = null

/**
 * Initialize the OpenTelemetry LoggerProvider that sends structured logs
 * to PostHog via OTLP HTTP.
 *
 * Call once during server startup (Nitro plugin). Subsequent calls are no-ops.
 */
export function initLoggerProvider(): void {
  if (loggerProvider) return

  const token = process.env.POSTHOG_PUBLIC_KEY
  if (!token) return

  const host = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com'

  loggerProvider = new LoggerProvider({
    resource: resourceFromAttributes({
      'service.name': 'reqcore',
      'service.version': '1.2.0',
      'deployment.environment': process.env.RAILWAY_ENVIRONMENT_NAME || 'development',
    }),
  })

  loggerProvider.addLogRecordProcessor(
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: `${host}/i/v1/logs`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }),
    ),
  )

  logs.setGlobalLoggerProvider(loggerProvider)
}

/**
 * Flush pending logs and shut down the provider.
 * Call during server shutdown so buffered logs aren't lost.
 */
export async function shutdownLoggerProvider(): Promise<void> {
  if (!loggerProvider) return
  await loggerProvider.forceFlush()
  await loggerProvider.shutdown()
  loggerProvider = null
}

// ─────────────────────────────────────────────
// Convenience logger — wraps the OTel API
// ─────────────────────────────────────────────

function getLogger() {
  return logs.getLogger('reqcore')
}

interface LogContext {
  posthogDistinctId?: string
  org_id?: string
  [key: string]: unknown
}

/**
 * Emit an INFO-level structured log to PostHog.
 */
export function logInfo(body: string, attributes?: LogContext): void {
  try {
    getLogger().emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body,
      attributes: attributes as Record<string, unknown>,
    })
  }
  catch {
    // Logging must never break the primary operation
  }
}

/**
 * Emit a WARN-level structured log to PostHog.
 */
export function logWarn(body: string, attributes?: LogContext): void {
  try {
    getLogger().emit({
      severityNumber: SeverityNumber.WARN,
      severityText: 'WARN',
      body,
      attributes: attributes as Record<string, unknown>,
    })
  }
  catch {
    // Logging must never break the primary operation
  }
}

/**
 * Emit an ERROR-level structured log to PostHog.
 */
export function logError(body: string, attributes?: LogContext): void {
  try {
    getLogger().emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body,
      attributes: attributes as Record<string, unknown>,
    })
  }
  catch {
    // Logging must never break the primary operation
  }
}

/**
 * Extract common request attributes from an H3 event for wide-event logging.
 */
export function requestAttributes(event: H3Event): Record<string, string | undefined> {
  const headers = getHeaders(event)
  return {
    http_method: getMethod(event),
    http_path: getRequestURL(event).pathname,
    user_agent: headers['user-agent'],
  }
}

interface SessionInfo {
  user: { id: string }
  session: { activeOrganizationId: string }
}

/**
 * Build a wide-event log for a completed API request.
 * Follows PostHog best practices: one structured log per request with full context.
 */
export function logApiRequest(
  event: H3Event,
  session: SessionInfo | null,
  body: string,
  extra?: Record<string, unknown>,
): void {
  logInfo(body, {
    ...requestAttributes(event),
    posthogDistinctId: session?.user?.id,
    org_id: session?.session?.activeOrganizationId,
    ...extra,
  })
}

/**
 * Log an API error as a wide event with full request context.
 */
export function logApiError(
  event: H3Event,
  session: SessionInfo | null,
  body: string,
  extra?: Record<string, unknown>,
): void {
  logError(body, {
    ...requestAttributes(event),
    posthogDistinctId: session?.user?.id,
    org_id: session?.session?.activeOrganizationId,
    ...extra,
  })
}
