import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import OrganizationClient from "./OrganizationClient"

export default async function OrganizationPage() {
  const user = await requireAuth()

  const [departments, jobRoles, employeeProfiles, teams] = await Promise.all([
    prisma.department.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
        leadProfileId: true,
        leadProfile: {
          select: { id: true, user: { select: { name: true } } },
        },
        _count: {
          select: { employeeProfiles: true, jobRoles: true, teams: true },
        },
      },
    }),
    prisma.jobRole.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
        departmentId: true,
        department: { select: { id: true, name: true, code: true } },
        _count: { select: { employeeProfiles: true } },
      },
    }),
    prisma.employeeProfile.findMany({
      where: { companyId: user.companyId },
      orderBy: { user: { name: "asc" } },
      select: {
        id: true,
        user: {
          select: { id: true, name: true, email: true, isActive: true },
        },
        department: { select: { id: true, name: true } },
        jobRole: { select: { id: true, name: true } },
        teamMemberships: { select: { allocationPercent: true } },
      },
    }),
    prisma.team.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
        departmentId: true,
        leadProfileId: true,
        department: { select: { id: true, name: true, code: true } },
        leadProfile: {
          select: { id: true, user: { select: { name: true } } },
        },
        memberships: {
          orderBy: { createdAt: "asc" },
          include: {
            employeeProfile: {
              select: {
                id: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
    }),
  ])

  return (
    <OrganizationClient
      canManage={hasRole(user.role, ACCESS_ROLES.organizationManagement)}
      departments={departments}
      jobRoles={jobRoles}
      employeeProfiles={employeeProfiles.map((profile) => ({
        ...profile,
        allocatedPercent: profile.teamMemberships.reduce(
          (total, membership) => total + membership.allocationPercent,
          0
        ),
        teamMemberships: undefined,
      }))}
      teams={teams}
    />
  )
}
