import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertCanEditTask, hasRole } from "@/lib/access-control"
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

const updateTaskSchema = z.object({
  projectId: z.string().optional().nullable(),
  phaseId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  title: z.string().trim().min(2).optional(),
  description: z.string().trim().optional().nullable(),
  status: z
    .enum(["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE", "CANCELLED", "ARCHIVED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  source: z
    .enum(["MANUAL", "WEBSITE_REQUEST", "WORKFLOW", "AI_GENERATED"])
    .optional(),
  sourceRef: z.string().trim().optional().nullable(),
  estimatedHours: z.string().trim().optional().nullable(),
  progress: z.number().int().min(0).max(100).optional(),
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

async function getTask(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth()
  const { id } = await context.params
  const scope = await resolveTaskAccessScope(user)

  const task = await prisma.task.findFirst({
    where: {
      id,
      companyId: user.companyId,
      ...buildTaskVisibilityWhere(scope),
    },
    include: {
      project: { select: { id: true, name: true } },
      phase: { select: { id: true, name: true, status: true, progress: true } },
      client: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      participants: {
        include: {
          employeeProfile: {
            select: {
              id: true,
              user: { select: { id: true, name: true, email: true } },
              jobRole: { select: { id: true, name: true } },
            },
          },
        },
      },
      dependencies: {
        where: {
          dependsOnTask: buildTaskVisibilityWhere(scope),
        },
        include: {
          dependsOnTask: {
            select: { id: true, title: true, status: true, progress: true },
          },
        },
      },
      blockers: {
        orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
        include: {
          reportedBy: { select: { id: true, name: true } },
          resolvedBy: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!task) {
    return err("المهمة غير موجودة", 404, { code: "TASK_NOT_FOUND" })
  }

  return ok({ task })
}

async function updateTask(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id } = await context.params
  const body = await readJsonBody(request)
  const scope = await resolveTaskAccessScope(user)
  const parsed = updateTaskSchema.safeParse(body)

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "بيانات المهمة غير صحيحة", 400, {
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    })
  }

  const existingTask = await prisma.task.findFirst({
    where: {
      id,
      companyId: user.companyId,
      ...buildTaskVisibilityWhere(scope),
    },
    include: {
      participants: {
        select: {
          role: true,
          employeeProfile: { select: { id: true, userId: true } },
        },
      },
      project: {
        select: {
          members: {
            where: {
              employeeProfile: {
                userId: user.id,
              },
            },
            select: {
              role: true,
            },
            take: 1,
          },
        },
      },
      _count: {
        select: {
          dependencies: true,
          dependents: true,
        },
      },
    },
  })

  if (!existingTask) {
    return err("المهمة غير موجودة", 404, { code: "TASK_NOT_FOUND" })
  }

  const data = parsed.data
  const projectMemberRole = existingTask.project?.members[0]?.role
  const globalTaskManager = hasRole(user.role, ACCESS_ROLES.taskManagement)
  const projectTaskManager =
    projectMemberRole === "PROJECT_LEAD" || projectMemberRole === "MANAGER"
  const assignmentManager = globalTaskManager || projectTaskManager

  assertCanEditTask(user, {
    assignedToId: existingTask.assignedToId,
    createdById: existingTask.createdById,
    participants: existingTask.participants.map((participant) => ({
      userId: participant.employeeProfile.userId,
      role: participant.role,
    })),
    projectMemberRole,
    managedUserIds: scope.managedUserIds,
  })

  if (
    data.assignedToId !== undefined &&
    !assignmentManager &&
    !canAssignTaskTo(scope, data.assignedToId || null)
  ) {
    throw new ApiError(
      "يمكنك إعادة إسناد المهمة لنفسك أو لأعضاء نطاق عملك فقط",
      403,
      "TASK_ASSIGNMENT_FORBIDDEN"
    )
  }

  if (!globalTaskManager && data.source !== undefined) {
    throw new ApiError("لا يمكنك تغيير مصدر المهمة", 403, "TASK_SOURCE_FORBIDDEN")
  }

  const safeProjectId =
    data.projectId !== undefined ? data.projectId || null : existingTask.projectId
  const safePhaseId =
    data.phaseId !== undefined
      ? data.phaseId || null
      : data.projectId !== undefined && safeProjectId !== existingTask.projectId
        ? null
        : existingTask.phaseId
  let safeClientId =
    data.clientId !== undefined ? data.clientId || null : existingTask.clientId
  const safeAssignedToId =
    data.assignedToId !== undefined ? data.assignedToId || null : existingTask.assignedToId
  const projectChanged =
    data.projectId !== undefined &&
    safeProjectId !== existingTask.projectId
  const clientChanged =
    data.clientId !== undefined &&
    safeClientId !== existingTask.clientId

  if (
    projectChanged &&
    !canUseTaskProject(scope, safeProjectId)
  ) {
    throw new ApiError(
      "لا يمكنك نقل المهمة إلى مشروع خارج نطاق عملك",
      403,
      "TASK_PROJECT_FORBIDDEN"
    )
  }

  if (
    projectChanged &&
    (existingTask._count.dependencies > 0 || existingTask._count.dependents > 0)
  ) {
    return err("أزل تبعيات المهمة قبل نقلها إلى مشروع آخر", 409, {
      code: "TASK_HAS_PROJECT_DEPENDENCIES",
      details: {
        dependencies: existingTask._count.dependencies,
        dependents: existingTask._count.dependents,
      },
    })
  }

  if (safeProjectId) {
    const project = await prisma.project.findFirst({
      where: { id: safeProjectId, companyId: user.companyId },
      select: { id: true, clientId: true },
    })
    if (!project) return err("المشروع المحدد غير موجود", 404, { code: "PROJECT_NOT_FOUND" })

    if (
      projectExecutionNeedsActivation({
        assignedToId:
          data.assignedToId !== undefined || projectChanged
            ? safeAssignedToId
            : null,
        progress: data.progress,
        status: data.status,
      })
    ) {
      await assertProjectExecutionActivated(prisma, {
        companyId: user.companyId,
        projectId: project.id,
      })
    }

    if (data.clientId === undefined && project.clientId) safeClientId = project.clientId

    if (
      !scope.canViewCompanyTasks &&
      safeClientId &&
      (clientChanged || projectChanged) &&
      project.clientId !== safeClientId
    ) {
      throw new ApiError(
        "عميل المهمة يجب أن يطابق عميل المشروع",
        403,
        "TASK_CLIENT_FORBIDDEN"
      )
    }
  } else if (
    !scope.canViewCompanyTasks &&
    safeClientId &&
    (clientChanged || projectChanged)
  ) {
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
      select: { employeeProfile: { select: { id: true } } },
    })
    if (!assignedUser) {
      return err("الموظف المحدد غير موجود أو غير فعال", 404, {
        code: "ASSIGNEE_NOT_FOUND",
      })
    }
    assignedEmployeeProfileId = assignedUser.employeeProfile?.id ?? null
  }

  let action: ActivityAction = ActivityAction.TASK_UPDATED
  if (data.status === "ARCHIVED" && existingTask.status !== "ARCHIVED") {
    action = ActivityAction.TASK_ARCHIVED
  }
  if (existingTask.status === "ARCHIVED" && data.status && data.status !== "ARCHIVED") {
    action = ActivityAction.TASK_RESTORED
  }
  if (data.status === "DONE" && existingTask.status !== "DONE") {
    action = ActivityAction.TASK_COMPLETED
  }

  const nextStatus = data.status ?? existingTask.status
  const nextProgress =
    nextStatus === "DONE"
      ? 100
      : data.progress !== undefined
        ? assertProgress(data.progress)
        : existingTask.progress

  const task = await prisma.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
      where: { id: existingTask.id },
      data: {
        ...(data.projectId !== undefined ? { projectId: safeProjectId } : {}),
        ...(data.phaseId !== undefined || data.projectId !== undefined
          ? { phaseId: safePhaseId }
          : {}),
        ...(data.clientId !== undefined || data.projectId !== undefined
          ? { clientId: safeClientId }
          : {}),
        ...(data.assignedToId !== undefined ? { assignedToId: safeAssignedToId } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined
          ? { description: nullableText(data.description) }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.sourceRef !== undefined
          ? { sourceRef: nullableText(data.sourceRef) }
          : {}),
        ...(data.estimatedHours !== undefined
          ? { estimatedHours: nullableDecimal(data.estimatedHours) }
          : {}),
        ...(data.dueDate !== undefined ? { dueDate: nullableDate(data.dueDate) } : {}),
        progress: nextProgress,
        ...(nextStatus === "DONE" && !existingTask.completedAt
          ? { completedAt: new Date() }
          : {}),
        ...(nextStatus !== "DONE" ? { completedAt: null } : {}),
        ...(!["TODO", "CANCELLED", "ARCHIVED"].includes(nextStatus) &&
        !existingTask.startedAt
          ? { startedAt: new Date() }
          : {}),
      },
    })

    if (data.assignedToId !== undefined) {
      await tx.taskParticipant.updateMany({
        where: { taskId: existingTask.id, role: "OWNER" },
        data: { role: "CONTRIBUTOR" },
      })

      if (assignedEmployeeProfileId) {
        await tx.taskParticipant.upsert({
          where: {
            taskId_employeeProfileId: {
              taskId: existingTask.id,
              employeeProfileId: assignedEmployeeProfileId,
            },
          },
          create: {
            companyId: user.companyId,
            taskId: existingTask.id,
            employeeProfileId: assignedEmployeeProfileId,
            role: "OWNER",
          },
          update: { role: "OWNER" },
        })
      }
    }

    if (
      assignedEmployeeProfileId &&
      safeProjectId &&
      (data.assignedToId !== undefined || data.projectId !== undefined)
    ) {
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

    if (
      data.projectId !== undefined &&
      safeProjectId &&
      existingTask.participants.length > 0
    ) {
      await tx.projectMember.createMany({
        data: existingTask.participants.map((participant) => ({
          companyId: user.companyId,
          projectId: safeProjectId,
          employeeProfileId: participant.employeeProfile.id,
          role: "CONTRIBUTOR" as const,
          responsibility: "مشارك من خلال مهمة ضمن المشروع",
        })),
        skipDuplicates: true,
      })
    }

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action,
        entityType: "Task",
        entityId: updatedTask.id,
        message: `تم تعديل المهمة: ${updatedTask.title}`,
        metadata: {
          taskTitle: updatedTask.title,
          projectId: updatedTask.projectId,
          phaseId: updatedTask.phaseId,
          assignedToId: updatedTask.assignedToId,
          status: updatedTask.status,
          priority: updatedTask.priority,
          progress: updatedTask.progress,
        },
      },
    })

    return updatedTask
  })

  return ok({ task })
}

export const GET = withApiHandler("TASK_GET_ERROR", getTask)
export const PATCH = withApiHandler(
  "TASK_PATCH_ERROR",
  updateTask,
  "حدث خطأ أثناء تعديل المهمة"
)
