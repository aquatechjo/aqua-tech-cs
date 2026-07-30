import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError, err, ok, withApiHandler } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { assertProgress } from "@/lib/project-execution"
import { prisma } from "@/lib/prisma"
import { projectExecutionNeedsActivation } from "@/lib/project-readiness"
import { assertProjectExecutionActivated } from "@/lib/project-readiness-server"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import {
  buildTaskVisibilityWhere,
  canAssignTaskTo,
  canUseTaskProject,
} from "@/lib/task-scope"
import { resolveTaskAccessScope } from "@/lib/task-scope-server"

const optionalDateStringSchema = z.string().refine(
  (value) => value.trim() === "" || !Number.isNaN(Date.parse(value)),
  "صيغة التاريخ غير صحيحة"
)

const taskSchema = z.object({
  projectId: z.string().optional().nullable(),
  phaseId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  title: z.string().trim().min(2, "عنوان المهمة مطلوب"),
  description: z.string().trim().optional().nullable(),
  status: z
    .enum(["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE", "CANCELLED", "ARCHIVED"])
    .default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  source: z
    .enum(["MANUAL", "WEBSITE_REQUEST", "WORKFLOW", "AI_GENERATED"])
    .default("MANUAL"),
  sourceRef: z.string().trim().optional().nullable(),
  estimatedHours: z.string().trim().optional().nullable(),
  progress: z.number().int().min(0).max(100).default(0),
  dueDate: optionalDateStringSchema.optional().nullable(),
})

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function nullableDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function nullableDecimal(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.trim()
  if (!normalized) return null
  const number = Number(normalized)
  return Number.isFinite(number) && number >= 0 ? normalized : null
}

async function getTasks() {
  const user = await requireAuth()
  const scope = await resolveTaskAccessScope(user)

  const tasks = await prisma.task.findMany({
    where: {
      companyId: user.companyId,
      ...buildTaskVisibilityWhere(scope),
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      project: { select: { id: true, name: true } },
      phase: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      participants: {
        include: {
          employeeProfile: {
            select: {
              id: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
      blockers: {
        where: { status: "OPEN" },
        select: { id: true, title: true, severity: true },
      },
    },
  })

  return ok({ tasks })
}

async function createTask(request: Request) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const body = await readJsonBody(request)
  const parsed = taskSchema.safeParse(body)

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "بيانات المهمة غير صحيحة", 400, {
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    })
  }

  const data = parsed.data
  const scope = await resolveTaskAccessScope(user)
  const safeProjectId = data.projectId || null
  const safePhaseId = data.phaseId || null
  let safeClientId = data.clientId || null
  const safeAssignedToId = data.assignedToId || null

  if (!canAssignTaskTo(scope, safeAssignedToId)) {
    throw new ApiError(
      "يمكنك إسناد المهمة لنفسك أو لأعضاء نطاق عملك فقط",
      403,
      "TASK_ASSIGNMENT_FORBIDDEN"
    )
  }

  if (!scope.canViewCompanyTasks && data.source !== "MANUAL") {
    throw new ApiError(
      "مصدر المهمة الآلي متاح للإدارة وعمليات النظام فقط",
      403,
      "TASK_SOURCE_FORBIDDEN"
    )
  }

  if (!canUseTaskProject(scope, safeProjectId)) {
    throw new ApiError(
      "لا يمكنك ربط المهمة بمشروع خارج نطاق عملك",
      403,
      "TASK_PROJECT_FORBIDDEN"
    )
  }

  if (safeProjectId) {
    const project = await prisma.project.findFirst({
      where: { id: safeProjectId, companyId: user.companyId },
      select: { id: true, clientId: true },
    })

    if (!project) {
      return err("المشروع المحدد غير موجود", 404, { code: "PROJECT_NOT_FOUND" })
    }

    if (
      projectExecutionNeedsActivation({
        assignedToId: safeAssignedToId,
        progress: data.progress,
        status: data.status,
      })
    ) {
      await assertProjectExecutionActivated(prisma, {
        companyId: user.companyId,
        projectId: project.id,
      })
    }

    if (!safeClientId && project.clientId) safeClientId = project.clientId

    if (
      !scope.canViewCompanyTasks &&
      safeClientId &&
      project.clientId !== safeClientId
    ) {
      throw new ApiError(
        "عميل المهمة يجب أن يطابق عميل المشروع",
        403,
        "TASK_CLIENT_FORBIDDEN"
      )
    }
  } else if (!scope.canViewCompanyTasks && safeClientId) {
    throw new ApiError(
      "ربط مهمة مستقلة بعميل متاح للإدارة فقط",
      403,
      "TASK_CLIENT_FORBIDDEN"
    )
  }

  if (safePhaseId) {
    if (!safeProjectId) {
      return err("لا يمكن اختيار مرحلة دون مشروع", 400, {
        code: "PHASE_PROJECT_REQUIRED",
      })
    }

    const phase = await prisma.projectPhase.findFirst({
      where: {
        id: safePhaseId,
        projectId: safeProjectId,
        companyId: user.companyId,
      },
      select: { id: true },
    })

    if (!phase) {
      return err("المرحلة المحددة غير موجودة داخل المشروع", 404, {
        code: "PROJECT_PHASE_NOT_FOUND",
      })
    }
  }

  if (safeClientId) {
    const client = await prisma.client.findFirst({
      where: { id: safeClientId, companyId: user.companyId },
      select: { id: true },
    })
    if (!client) return err("العميل المحدد غير موجود", 404, { code: "CLIENT_NOT_FOUND" })
  }

  let assignedEmployeeProfileId: string | null = null
  if (safeAssignedToId) {
    const assignedUser = await prisma.user.findFirst({
      where: { id: safeAssignedToId, companyId: user.companyId, isActive: true },
      select: {
        id: true,
        employeeProfile: { select: { id: true } },
      },
    })

    if (!assignedUser) {
      return err("الموظف المحدد غير موجود أو غير فعال", 404, {
        code: "ASSIGNEE_NOT_FOUND",
      })
    }
    assignedEmployeeProfileId = assignedUser.employeeProfile?.id ?? null
  }

  const normalizedProgress = data.status === "DONE" ? 100 : assertProgress(data.progress)

  const task = await prisma.$transaction(async (tx) => {
    const createdTask = await tx.task.create({
      data: {
        companyId: user.companyId,
        projectId: safeProjectId,
        phaseId: safePhaseId,
        clientId: safeClientId,
        assignedToId: safeAssignedToId,
        createdById: user.id,
        title: data.title,
        description: nullableText(data.description),
        status: data.status,
        priority: data.priority,
        source: data.source,
        sourceRef: nullableText(data.sourceRef),
        estimatedHours: nullableDecimal(data.estimatedHours),
        progress: normalizedProgress,
        dueDate: nullableDate(data.dueDate),
        startedAt:
          data.status === "TODO" || data.status === "CANCELLED" || data.status === "ARCHIVED"
            ? null
            : new Date(),
        completedAt: data.status === "DONE" ? new Date() : null,
      },
    })

    if (assignedEmployeeProfileId) {
      await tx.taskParticipant.create({
        data: {
          companyId: user.companyId,
          taskId: createdTask.id,
          employeeProfileId: assignedEmployeeProfileId,
          role: "OWNER",
        },
      })

      if (safeProjectId) {
        await tx.projectMember.upsert({
          where: {
            projectId_employeeProfileId: {
              projectId: safeProjectId,
              employeeProfileId: assignedEmployeeProfileId,
            },
          },
          create: {
            companyId: user.companyId,
            projectId: safeProjectId,
            employeeProfileId: assignedEmployeeProfileId,
            role: "CONTRIBUTOR",
            responsibility: "مشارك من خلال مهمة مسندة",
          },
          update: {},
        })
      }
    }

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TASK_CREATED,
        entityType: "Task",
        entityId: createdTask.id,
        message: `تم إضافة مهمة جديدة: ${createdTask.title}`,
        metadata: {
          taskTitle: createdTask.title,
          projectId: createdTask.projectId,
          phaseId: createdTask.phaseId,
          assignedToId: createdTask.assignedToId,
          status: createdTask.status,
          priority: createdTask.priority,
          progress: createdTask.progress,
        },
      },
    })

    return createdTask
  })

  return ok({ task }, 201)
}

export const GET = withApiHandler("TASKS_GET_ERROR", getTasks)
export const POST = withApiHandler(
  "TASKS_POST_ERROR",
  createTask,
  "حدث خطأ أثناء إضافة المهمة"
)
