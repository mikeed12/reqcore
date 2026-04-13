import { eq, and, or, ilike, desc, sql } from 'drizzle-orm'
import { candidate, application } from '../../database/schema'
import { candidateQuerySchema } from '../../utils/schemas/candidate'

export default defineEventHandler(async (event) => {
    const session = await requirePermission(event, { candidate: ['read'] })

    const API_URL = 'https://phone.example.com';
    const TOKEN = ''


    let data: any
    try {
        const response = await $fetch<{ html_url: string }>(
            `${API_URL}/vitxi-service/v1/api/calls?offset=1&row_count=20`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${TOKEN}`,
                }
            },
        )
        data = response
    } catch (err: any) {
        logError('feedback.github_issue_failed', {
            error_message: err.data ?? err.message,
        })
        throw createError({
            statusCode: 502,
            statusMessage: err.data,
        })
    }


    return { data }
})
