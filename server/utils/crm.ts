type CrmResourceType = 'sync-application'

interface CrmFile {
    data: Buffer
    filename: string
    mimeType: string
}

/**
 * Fire-and-forget sync to the legacy CRM configured via CRM_BASE_URL / CRM_API_KEY.
 * POSTs `data` to `{CRM_BASE_URL}/{resourceType}` with the API key in the
 * Authorization header. No-ops silently when env vars are not set.
 * Never throws — failures are logged to stderr without breaking user flows.
 */
export async function syncToCrm(
    resourceType: CrmResourceType,
    data: Record<string, unknown>,
    file?: CrmFile | null,
): Promise<void> {
    try {
        const baseUrl = env.CRM_BASE_URL
        const apiKey = env.CRM_API_KEY

        if (!baseUrl || !apiKey) return

        const url = `${baseUrl.replace(/\/$/, '')}/${resourceType}`

        let body: BodyInit
        const headers: Record<string, string> = { 'Authorization': `Bearer ${apiKey}` }

        if (file) {
            const form = new FormData()
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined) {
                    form.append(key, String(value))
                }
            }
            form.append('resume', new Blob([file.data], { type: file.mimeType }), file.filename)
            body = form
            // Content-Type is set automatically by fetch when using FormData (includes boundary)
        } else {
            headers['Content-Type'] = 'application/json'
            body = JSON.stringify(data)
        }

        const response = await fetch(url, { method: 'POST', headers, body })

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
