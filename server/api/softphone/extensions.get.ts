import { eq, and, or, ilike, desc, sql } from 'drizzle-orm'
import { candidate, application } from '../../database/schema'
import { candidateQuerySchema } from '../../utils/schemas/candidate'

export default defineEventHandler(async (event) => {
    const session = await requirePermission(event, { candidate: ['read'] })

    const data= [
        { id: '100', name: 'Example', number: '(111) 1111111' },
    ];

    return { data }
})