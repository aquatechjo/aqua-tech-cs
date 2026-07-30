import type { Prisma } from "@/generated/prisma/client"
import { notFound } from "next/navigation"

import {
  canAssignTaskOwner,
  canEditTask,
  canManageProjectExecution,
  canManageProjectLeadership,
  canManageTaskParticipants,
} from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { averageProgress } from "@/lib/project-execution"
import {
  buildProjectVisibilityWhere,
  projectScopeFromTaskScope,
  projectScopeLabel,
} from "@/lib/project-scope"
import { prisma } from "@/lib/prisma"
import { buildTaskVisibilityWhere } from "@/lib/task-scope"
import { resolveTaskAccessScope } from "@/lib/task-scope-server"

import ProjectExecutionClient from "./ProjectExecutionClient"

export default async function ProjectExecutionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuth()
  const { id } = await params
  const taskScope = await resolveTaskAccessScope(user)
  const projectScope = projectScopeFromTaskScope(
    user.role,
    taskScope
  )
  const taskVisibilityWhere =
    buildTaskVisibilityWhere(taskScope)

  const project = await prisma.project.findFirst({
    where: {
      id,
      companyId: user.companyId,
      ...buildProjectVisibilityWhere(projectScope),
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      workflow: {
        include: {
          approvals: {
            select: {
              status: true,
            },
          },
          rules: {
            where: {
              isActive: true,
            },
            select: {
              channel: true,
            },
          },
        },
      },
      members: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: {
          employeeProfile: {
            select: {
              id: true,
              employeeNumber: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  isActive: true,
                },
              },
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
              jobRole: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      phases: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      tasks: {
        where: {
          status: {
            not: "ARCHIVED",
          },
          ...taskVisibilityWhere,
        },
        orderBy: [
          { sortOrder: "asc" },
          { dueDate: "asc" },
          { createdAt: "asc" },
        ],
        include: {
          phase: {
            select: {
              id: true,
              name: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          participants: {
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
            include: {
              employeeProfile: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                  jobRole: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          dependencies: {
            where: {
              dependsOnTask: taskVisibilityWhere,
            },
            include: {
              dependsOnTask: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  progress: true,
                },
              },
            },
          },
          blockers: {
            orderBy: [
              { status: "asc" },
              { severity: "desc" },
              { createdAt: "desc" },
            ],
            include: {
              reportedBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
              resolvedBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!project) notFound()

  const currentMembership = project.members.find(
    (member) => member.employeeProfile.user.id === user.id
  )
  const canManage = canManageProjectExecution(
    user,
    currentMembership?.role
  )
  const employeeWhere: Prisma.EmployeeProfileWhereInput = {
    companyId: user.companyId,
    status: "ACTIVE",
    user: {
      isActive: true,
      ...(taskScope.canViewCompanyTasks
        ? {}
        : {
            id: {
              in: [...taskScope.assignableUserIds],
            },
          }),
    },
  }
  const employees = await prisma.employeeProfile.findMany({
    where: employeeWhere,
    orderBy: {
      user: {
        name: "asc",
      },
    },
    select: {
      id: true,
      employeeNumber: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      jobRole: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  const tasks = project.tasks.map((task) => {
    const accessContext = {
      assignedToId: task.assignedToId,
      createdById: task.createdById,
      participants: task.participants.map((participant) => ({
        userId: participant.employeeProfile.user.id,
        role: participant.role,
      })),
      projectMemberRole: currentMembership?.role,
      managedUserIds: taskScope.managedUserIds,
    }

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      phaseId: task.phaseId,
      phase: task.phase,
      assignedToId: task.assignedToId,
      assignedTo: task.assignedTo,
      status: task.status,
      priority: task.priority,
      progress: task.progress,
      estimatedHours:
        task.estimatedHours?.toString() ?? null,
      workflowTaskCode: task.workflowTaskCode,
      workflowOwnerRole: task.workflowOwnerRole,
      dueDate: task.dueDate?.toISOString() ?? null,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt:
        task.completedAt?.toISOString() ?? null,
      canEdit: canEditTask(user, accessContext),
      canManageParticipants: canManageTaskParticipants(
        user,
        accessContext
      ),
      canAssignOwner: canAssignTaskOwner(
        user,
        currentMembership?.role
      ),
      participants: task.participants.map((participant) => ({
        id: participant.id,
        role: participant.role,
        employeeProfile: participant.employeeProfile,
      })),
      dependencies: task.dependencies.map((dependency) => ({
        id: dependency.id,
        type: dependency.type,
        dependsOnTaskId: dependency.dependsOnTaskId,
        dependsOnTask: dependency.dependsOnTask,
      })),
      blockers: task.blockers.map((blocker) => ({
        id: blocker.id,
        title: blocker.title,
        description: blocker.description,
        severity: blocker.severity,
        status: blocker.status,
        resolution: blocker.resolution,
        reportedBy: blocker.reportedBy,
        resolvedBy: blocker.resolvedBy,
        resolvedAt:
          blocker.resolvedAt?.toISOString() ?? null,
        createdAt: blocker.createdAt.toISOString(),
      })),
    }
  })

  const phases = project.phases.map((phase) => ({
    id: phase.id,
    name: phase.name,
    code: phase.code,
    workflowStageCode: phase.workflowStageCode,
    description: phase.description,
    status: phase.status,
    progress: phase.progress,
    sortOrder: phase.sortOrder,
    startDate: phase.startDate?.toISOString() ?? null,
    dueDate: phase.dueDate?.toISOString() ?? null,
    completedAt:
      phase.completedAt?.toISOString() ?? null,
  }))

  return (
    <ProjectExecutionClient
      project={{
        id: project.id,
        name: project.name,
        code: project.code,
        description: project.description,
        status: project.status,
        priority: project.priority,
        client: project.client,
        startDate: project.startDate?.toISOString() ?? null,
        dueDate: project.dueDate?.toISOString() ?? null,
        originProposalWorkspaceId:
          project.originProposalWorkspaceId,
        originProposalVersion: project.originProposalVersion,
        clientAcceptedAt:
          project.clientAcceptedAt?.toISOString() ?? null,
        proposalConvertedAt:
          project.proposalConvertedAt?.toISOString() ?? null,
      }}
      workflow={
        project.workflow
          ? {
              templateName: project.workflow.templateName,
              templateCode: project.workflow.templateCode,
              templateVersion: project.workflow.templateVersion,
              status: project.workflow.status,
              approvalCount: project.workflow.approvals.length,
              pendingApprovalCount:
                project.workflow.approvals.filter(
                  (approval) =>
                    approval.status === "PENDING" ||
                    approval.status === "NOT_REQUESTED"
                ).length,
              notificationRuleCount:
                project.workflow.rules.filter(
                  (rule) => rule.channel !== "N8N_EVENT"
                ).length,
              n8nRuleCount: project.workflow.rules.filter(
                (rule) => rule.channel === "N8N_EVENT"
              ).length,
            }
          : null
      }
      scope={{
        label: projectScopeLabel(projectScope),
        dataScope: projectScope.dataScope,
        description:
          projectScope.dataScope === "company"
            ? "عرض تنفيذي كامل للمشروع."
            : projectScope.dataScope === "team"
              ? "تظهر مهام فريقك ومسؤولياتك داخل المشروع."
              : "تظهر مهامك ومسؤولياتك داخل المشروع فقط.",
      }}
      members={project.members.map((member) => ({
        id: member.id,
        role: member.role,
        responsibility: member.responsibility,
        employeeProfile: member.employeeProfile,
      }))}
      phases={phases}
      tasks={tasks}
      employees={employees}
      canManage={canManage}
      canManageLeadership={canManageProjectLeadership(
        user,
        currentMembership?.role
      )}
      summary={{
        progress: averageProgress(
          tasks.map((task) => task.progress)
        ),
        totalTasks: tasks.length,
        completedTasks: tasks.filter(
          (task) => task.status === "DONE"
        ).length,
        blockedTasks: tasks.filter(
          (task) =>
            task.status === "BLOCKED" ||
            task.blockers.some(
              (blocker) => blocker.status === "OPEN"
            )
        ).length,
        openBlockers: tasks.reduce(
          (count, task) =>
            count +
            task.blockers.filter(
              (blocker) => blocker.status === "OPEN"
            ).length,
          0
        ),
      }}
    />
  )
}
