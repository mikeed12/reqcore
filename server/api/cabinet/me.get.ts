import { inArray, eq } from 'drizzle-orm'
import { candidate, application, job, organization } from '../../database/schema'
import { requireCabinetAuth } from '../../utils/cabinet-auth'

export default defineEventHandler(async (event) => {
  const candidateIds = await requireCabinetAuth(event)

  // Fetch all candidate rows (one per org they applied through)
  const candidates = await db
    .select({
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      organizationId: candidate.organizationId,
    })
    .from(candidate)
    .where(inArray(candidate.id, candidateIds))

  // Fetch all applications for these candidates
  const applications = await db
    .select({
      id: application.id,
      status: application.status,
      createdAt: application.createdAt,
      jobId: application.jobId,
      candidateId: application.candidateId,
      jobTitle: job.title,
      jobLocation: job.location,
      jobType: job.type,
      organizationName: organization.name,
    })
    .from(application)
    .innerJoin(job, eq(application.jobId, job.id))
    .innerJoin(organization, eq(application.organizationId, organization.id))
    .where(inArray(application.candidateId, candidateIds))
    .orderBy(application.createdAt)

  const primary = candidates[0]

  return {
    firstName: primary?.firstName ?? '',
    lastName: primary?.lastName ?? '',
    email: primary?.email ?? '',
    phone: primary?.phone ?? null,
    applications: applications.map(a => ({
      id: a.id,
      status: a.status,
      createdAt: a.createdAt,
      jobTitle: a.jobTitle,
      jobLocation: a.jobLocation,
      jobType: a.jobType,
      organizationName: a.organizationName,
    })),
  }
})
