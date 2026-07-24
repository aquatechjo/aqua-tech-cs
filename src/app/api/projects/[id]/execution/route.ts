import { err, ok, withApiHandler } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { averageProgress } from "@/lib/project-execution"
import { prisma } from "@/lib/prisma"

async function getProjectExecution(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth()
  const { id } = await context.params

  const project = await prisma.project.findFirst({
    where: {
      id,
      companyId: user.companyId,
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
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
    project,
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
