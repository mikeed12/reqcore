import { eq, and, or, ilike, desc, sql } from 'drizzle-orm'
import { candidate, application } from '../../database/schema'
import { candidateQuerySchema } from '../../utils/schemas/candidate'

export default defineEventHandler(async (event) => {
    const session = await requirePermission(event, { candidate: ['read'] })


    const data= [
        { id: '101', name: 'Main line', number: '(382) 3323923' },
        { id: '102', name: 'Sales desk', number: '(415) 4423923' },
        { id: '103', name: 'Recruiter line', number: '(321) 5153923' },
    ];


    return { data }
})
