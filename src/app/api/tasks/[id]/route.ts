import { z } from "zod";
import { ActivityAction } from "@/generated/prisma/enums";
import {
  ACCESS_ROLES,
  assertCanEditTask,
  hasRole,
} from "@/lib/access-control";
import { ApiError, err, ok, withApiHandler } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, readJsonBody } from "@/lib/request-security";

const updateTaskSchema = z.object({
  projectId: z.string().optional().nullable(),
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
  dueDate: z.string().optional().nullable(),
});

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function nullableDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function nullableDecimal(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value.trim();

  if (!normalized) return null;

  const number = Number(normalized);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return normalized;
}

async function getTask(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth();
  const { id } = await context.params;

  const task = await prisma.task.findFirst({
    where: {
      id,
      companyId: user.companyId,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      client: {
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
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!task) {
    return err("المهمة غير موجودة", 404, {
      code: "TASK_NOT_FOUND",
    });
  }

  return ok({ task });
}

async function updateTask(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  assertSameOrigin(request);

  const user = await requireAuth();
  const { id } = await context.params;

  const body = await readJsonBody(request);
  const parsed = updateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return err(
      parsed.error.issues[0]?.message ?? "بيانات المهمة غير صحيحة",
      400,
      {
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
    );
  }

  const existingTask = await prisma.task.findFirst({
    where: {
      id,
      companyId: user.companyId,
    },
  });

  if (!existingTask) {
    return err("المهمة غير موجودة", 404, {
      code: "TASK_NOT_FOUND",
    });
  }

  const data = parsed.data;
  const manager = hasRole(user.role, ACCESS_ROLES.taskManagement);

  assertCanEditTask(user, existingTask);

  if (
    !manager &&
    data.assignedToId !== undefined &&
    data.assignedToId !== user.id
  ) {
    throw new ApiError(
      "لا يمكنك إعادة إسناد المهمة لموظف آخر",
      403,
      "TASK_ASSIGNMENT_FORBIDDEN",
    );
  }

  if (!manager && data.source !== undefined) {
    throw new ApiError(
      "لا يمكنك تغيير مصدر المهمة",
      403,
      "TASK_SOURCE_FORBIDDEN",
    );
  }

  const safeProjectId =
    data.projectId !== undefined ? data.projectId || null : existingTask.projectId;

  let safeClientId =
    data.clientId !== undefined ? data.clientId || null : existingTask.clientId;

  const safeAssignedToId =
    data.assignedToId !== undefined
      ? data.assignedToId || null
      : existingTask.assignedToId;

  if (safeProjectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: safeProjectId,
        companyId: user.companyId,
      },
      select: {
        id: true,
        clientId: true,
      },
    });

    if (!project) {
      return err("المشروع المحدد غير موجود", 404, {
        code: "PROJECT_NOT_FOUND",
      });
    }

    if (data.clientId === undefined && project.clientId) {
      safeClientId = project.clientId;
    }
  }

  if (safeClientId) {
    const client = await prisma.client.findFirst({
      where: {
        id: safeClientId,
        companyId: user.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!client) {
      return err("العميل المحدد غير موجود", 404, {
        code: "CLIENT_NOT_FOUND",
      });
    }
  }

  if (safeAssignedToId) {
    const assignedUser = await prisma.user.findFirst({
      where: {
        id: safeAssignedToId,
        companyId: user.companyId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!assignedUser) {
      return err("الموظف المحدد غير موجود أو غير فعال", 404, {
        code: "ASSIGNEE_NOT_FOUND",
      });
    }
  }

  let action: ActivityAction = ActivityAction.TASK_UPDATED;

  if (data.status === "ARCHIVED" && existingTask.status !== "ARCHIVED") {
    action = ActivityAction.TASK_ARCHIVED;
  }

  if (existingTask.status === "ARCHIVED" && data.status && data.status !== "ARCHIVED") {
    action = ActivityAction.TASK_RESTORED;
  }

  if (data.status === "DONE" && existingTask.status !== "DONE") {
    action = ActivityAction.TASK_COMPLETED;
  }

  const task = await prisma.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
      where: {
        id: existingTask.id,
      },
      data: {
        ...(data.projectId !== undefined ? { projectId: safeProjectId } : {}),
        ...(data.clientId !== undefined || data.projectId !== undefined
          ? { clientId: safeClientId }
          : {}),
        ...(data.assignedToId !== undefined
          ? { assignedToId: safeAssignedToId }
          : {}),

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
        ...(data.dueDate !== undefined
          ? { dueDate: nullableDate(data.dueDate) }
          : {}),

        ...(data.status === "DONE" && !existingTask.completedAt
          ? { completedAt: new Date() }
          : {}),
        ...(data.status && data.status !== "DONE"
          ? { completedAt: null }
          : {}),
      },
    });

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
          clientId: updatedTask.clientId,
          assignedToId: updatedTask.assignedToId,
          status: updatedTask.status,
          priority: updatedTask.priority,
          source: updatedTask.source,
        },
      },
    });

    return updatedTask;
  });

  return ok({ task });
}

export const GET = withApiHandler("TASK_GET_ERROR", getTask);
export const PATCH = withApiHandler(
  "TASK_PATCH_ERROR",
  updateTask,
  "حدث خطأ أثناء تعديل المهمة",
);
