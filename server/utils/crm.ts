type CrmResourceType = 'candidates' | 'applications' | 'jobs'

/**
 * Fire-and-forget sync to the legacy CRM configured via CRM_BASE_URL / CRM_API_KEY.
 * POSTs `data` to `{CRM_BASE_URL}/{resourceType}` with the API key in the
 * Authorization header. No-ops silently when env vars are not set.
 * Never throws — failures are logged to stderr without breaking user flows.
 */
export async function syncToCrm(
    resourceType: CrmResourceType,
    data: Record<string, unknown>,
): Promise<void> {
    try {
        const baseUrl = env.CRM_BASE_URL
        const apiKey = env.CRM_API_KEY

        if (!baseUrl || !apiKey) return

        const url = `${baseUrl.replace(/\/$/, '')}/${resourceType}`

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(data),
        })

        if (!response.ok) {
            logWarn('crm_sync.request_failed', {
                resource_type: resourceType,
                status: response.status,
            })
        }
    }
    catch (err) {
        logWarn('crm_sync.error', {
            resource_type: resourceType,
            error_message: err instanceof Error ? err.message : String(err),
        })
    }
}
