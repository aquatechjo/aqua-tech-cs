import { err, ok, withApiHandler } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { averageProgress } from "@/lib/project-execution"
import {
  buildProjectVisibilityWhere,
  projectScopeFromTaskScope,
} from "@/lib/project-scope"
import { prisma } from "@/lib/prisma"
import { buildTaskVisibilityWhere } from "@/lib/task-scope"
import { resolveTaskAccessScope } from "@/lib/task-scope-server"

async function getProjectExecution(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth()
  const { id } = await context.params
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
        orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
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
            orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
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

  if (!project) {
    return err("المشروع غير موجود", 404, {
      code: "PROJECT_NOT_FOUND",
    })
  }

  return ok({
    project: {
      id: project.id,
      clientId: project.clientId,
      client: project.client,
      name: project.name,
      code: project.code,
      description: project.description,
      status: project.status,
      priority: project.priority,
      budget: projectScope.canViewProjectBudgets
        ? project.budget?.toString() ?? null
        : null,
      currency: project.currency,
      startDate: project.startDate,
      dueDate: project.dueDate,
      completedAt: project.completedAt,
      members: project.members,
      phases: project.phases,
      tasks: project.tasks,
      workflow: project.workflow
        ? {
            templateName: project.workflow.templateName,
            templateCode: project.workflow.templateCode,
            templateVersion: project.workflow.templateVersion,
            status: project.workflow.status,
            approvalCount: project.workflow.approvals.length,
            pendingApprovalCount: project.workflow.approvals.filter(
              (approval) =>
                approval.status === "PENDING" ||
                approval.status === "NOT_REQUESTED"
            ).length,
            notificationRuleCount: project.workflow.rules.filter(
              (rule) => rule.channel !== "N8N_EVENT"
            ).length,
            n8nRuleCount: project.workflow.rules.filter(
              (rule) => rule.channel === "N8N_EVENT"
            ).length,
          }
        : null,
    },
    summary: {
      progress: averageProgress(project.tasks.map((task) => task.progress)),
      totalTasks: project.tasks.length,
      completedTasks: project.tasks.filter((task) => task.status === "DONE").length,
      blockedTasks: project.tasks.filter(
        (task) =>
          task.status === "BLOCKED" ||
          task.blockers.some((blocker) => blocker.status === "OPEN")
      ).length,
      openBlockers: project.tasks.reduce(
        (count, task) =>
          count + task.blockers.filter((blocker) => blocker.status === "OPEN").length,
        0
      ),
    },
  })
}

export const GET = withApiHandler(
  "PROJECT_EXECUTION_GET_ERROR",
  getProjectExecution,
  "حدث خطأ أثناء تحميل تنفيذ المشروع"
)
