import "server-only"

import type { AccessRole } from "@/generated/prisma/enums"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { prisma } from "@/lib/prisma"
import type { TaskAccessScope } from "@/lib/task-scope"

type ScopeUser = {
  id: string
  companyId: string
  role: AccessRole
}

export async function resolveTaskAccessScope(
  user: ScopeUser
): Promise<TaskAccessScope> {
  const canViewCompanyTasks = hasRole(
    user.role,
    ACCESS_ROLES.taskManagement
  )

  if (canViewCompanyTasks) {
    return {
      userId: user.id,
      dataScope: "company",
      canViewCompanyTasks: true,
      managedUserIds: [],
      visibleProjectIds: [],
      managedProjectIds: [],
      assignableUserIds: [],
      jobRoleName: null,
    }
  }

  const profile = await prisma.employeeProfile.findFirst({
    where: {
      companyId: user.companyId,
      userId: user.id,
    },
    select: {
      id: true,
      jobRole: {
        select: {
          name: true,
        },
      },
      reports: {
        where: {
          status: {
            in: ["ACTIVE", "ON_LEAVE"],
          },
          user: {
            isActive: true,
          },
        },
        select: {
          userId: true,
        },
      },
      ledDepartments: {
        where: {
          isActive: true,
        },
        select: {
          employeeProfiles: {
            where: {
              status: {
                in: ["ACTIVE", "ON_LEAVE"],
              },
              user: {
                isActive: true,
              },
            },
            select: {
              userId: true,
            },
          },
        },
      },
      ledTeams: {
        where: {
          isActive: true,
        },
        select: {
          memberships: {
            where: {
              employeeProfile: {
                status: {
                  in: ["ACTIVE", "ON_LEAVE"],
                },
                user: {
                  isActive: true,
                },
              },
            },
            select: {
              employeeProfile: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      },
      projectMemberships: {
        select: {
          role: true,
          projectId: true,
          project: {
            select: {
              members: {
                where: {
                  employeeProfile: {
                    status: {
                      in: ["ACTIVE", "ON_LEAVE"],
                    },
                    user: {
                      isActive: true,
                    },
                  },
                },
                select: {
                  employeeProfile: {
                    select: {
                      userId: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  const managedUserIds = new Set<string>()
  const visibleProjectIds = new Set<string>()
  const managedProjectIds = new Set<string>()
  const assignableUserIds = new Set<string>([user.id])

  for (const report of profile?.reports ?? []) {
    managedUserIds.add(report.userId)
  }

  for (const department of profile?.ledDepartments ?? []) {
    for (const employee of department.employeeProfiles) {
      managedUserIds.add(employee.userId)
    }
  }

  for (const team of profile?.ledTeams ?? []) {
    for (const membership of team.memberships) {
      managedUserIds.add(membership.employeeProfile.userId)
    }
  }

  for (const membership of profile?.projectMemberships ?? []) {
    visibleProjectIds.add(membership.projectId)

    if (membership.role === "PROJECT_LEAD" || membership.role === "MANAGER") {
      managedProjectIds.add(membership.projectId)

      for (const projectMember of membership.project.members) {
        assignableUserIds.add(projectMember.employeeProfile.userId)
      }
    }
  }

  managedUserIds.delete(user.id)
  for (const managedUserId of managedUserIds) {
    assignableUserIds.add(managedUserId)
  }

  const visibleWorkUserIds = [
    user.id,
    ...managedUserIds,
  ]
  const relatedTaskProjects = await prisma.task.findMany({
    where: {
      companyId: user.companyId,
      projectId: {
        not: null,
      },
      OR: [
        {
          assignedToId: {
            in: visibleWorkUserIds,
          },
        },
        {
          createdById: user.id,
        },
        {
          participants: {
            some: {
              employeeProfile: {
                userId: {
                  in: visibleWorkUserIds,
                },
              },
            },
          },
        },
        ...(managedProjectIds.size > 0
          ? [
              {
                projectId: {
                  in: [...managedProjectIds],
                },
              },
            ]
          : []),
      ],
    },
    distinct: ["projectId"],
    select: {
      projectId: true,
    },
  })

  for (const task of relatedTaskProjects) {
    if (task.projectId) visibleProjectIds.add(task.projectId)
  }

  const hasManagedScope =
    managedUserIds.size > 0 || managedProjectIds.size > 0

  return {
    userId: user.id,
    dataScope: hasManagedScope ? "team" : "personal",
    canViewCompanyTasks: false,
    managedUserIds: [...managedUserIds],
    visibleProjectIds: [...visibleProjectIds],
    managedProjectIds: [...managedProjectIds],
    assignableUserIds: [...assignableUserIds],
    jobRoleName: profile?.jobRole?.name ?? null,
  }
}
