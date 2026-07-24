import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TeamClient from "./TeamClient";

export default async function TeamPage() {
  const currentUser = await requireAuth();

  const [users, departments, jobRoles] = await Promise.all([
    prisma.user.findMany({
      where: {
        companyId: currentUser.companyId,
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        employeeProfile: {
          select: {
            id: true,
            employeeNumber: true,
            departmentId: true,
            jobRoleId: true,
            employmentType: true,
            workHoursPerWeek: true,
            department: { select: { id: true, name: true, code: true } },
            jobRole: { select: { id: true, name: true, code: true } },
          },
        },
      },
    }),
    prisma.department.findMany({
      where: { companyId: currentUser.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
    prisma.jobRole.findMany({
      where: { companyId: currentUser.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, departmentId: true },
    }),
  ])

  return (
    <TeamClient
      users={users.map((user) => ({
        ...user,
        employeeProfile: user.employeeProfile
          ? {
              ...user.employeeProfile,
              workHoursPerWeek: Number(
                user.employeeProfile.workHoursPerWeek
              ),
            }
          : null,
      }))}
      departments={departments}
      jobRoles={jobRoles}
      currentUser={{
        id: currentUser.id,
        role: currentUser.role,
      }}
    />
  );
}
