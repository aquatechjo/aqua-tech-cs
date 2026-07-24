import { ok, withApiHandler } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { classifyMyDayDueDate } from "@/lib/project-execution"
import { prisma } from "@/lib/prisma"

async function getMyDay() {
  const user = await requireAuth()
  const now = new Date()

  const tasks = await prisma.task.findMany({
    where: {
      companyId: user.companyId,
      status: {
        notIn: ["DONE", "CANCELLED", "ARCHIVED"],
      },
      OR: [
        { assignedToId: user.id },
        {
          participants: {
            some: {
              employeeProfile: {
                userId: user.id,
              },
            },
          },
        },
      ],
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
    take: 100,
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      phase: {
        select: {
          id: true,
          name: true,
        },
      },
      blockers: {
        where: {
          status: "OPEN",
        },
        select: {
          id: true,
          title: true,
          severity: true,
        },
      },
      participants: {
        include: {
          employeeProfile: {
            select: {
              id: true,
              user: {
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

  const items = tasks.map((task) => ({
    ...task,
    bucket: classifyMyDayDueDate(
      task.dueDate,
      now,
      user.company.timezone || "Asia/Amman"
    ),
  }))

  return ok({
    now: now.toISOString(),
    timezone: user.company.timezone,
    tasks: items,
    summary: {
      overdue: items.filter((item) => item.bucket === "OVERDUE").length,
      today: items.filter((item) => item.bucket === "TODAY").length,
      upcoming: items.filter((item) => item.bucket === "UPCOMING").length,
      noDueDate: items.filter((item) => item.bucket === "NO_DUE_DATE").length,
      blocked: items.filter((item) => item.status === "BLOCKED" || item.blockers.length > 0)
        .length,
    },
  })
}

export const GET = withApiHandler(
  "MY_DAY_GET_ERROR",
  getMyDay,
  "حدث خطأ أثناء تحميل مهام اليوم"
)
