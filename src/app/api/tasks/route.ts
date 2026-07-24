import { z } from "zod";
import { ActivityAction } from "@/generated/prisma/enums";
import { ACCESS_ROLES, hasRole } from "@/lib/access-control";
import { ApiError, err, ok, withApiHandler } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, readJsonBody } from "@/lib/request-security";

const taskSchema = z.object({
  projectId: z.string().optional().nullable(),
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

async function getTasks() {
  const user = await requireAuth();

  const tasks = await prisma.task.findMany({
    where: {
      companyId: user.companyId,
    },
    orderBy: {
      createdAt: "desc",
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
    },
  });

  return ok({ tasks });
}

async function createTask(request: Request) {
  assertSameOrigin(request);

  const user = await requireAuth();
  const body = await readJsonBody(request);

  const parsed = taskSchema.safeParse(body);

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

  const data = parsed.data;
  const manager = hasRole(user.role, ACCESS_ROLES.taskManagement);

  const safeProjectId: string | null = data.projectId || null;
  let safeClientId: string | null = data.clientId || null;
  const safeAssignedToId: string | null = data.assignedToId || null;

  if (!manager && safeAssignedToId && safeAssignedToId !== user.id) {
    throw new ApiError(
      "لا يمكنك إسناد مهمة لموظف آخر",
      403,
      "TASK_ASSIGNMENT_FORBIDDEN",
    );
  }

  if (!manager && data.source !== "MANUAL") {
    throw new ApiError(
      "مصدر المهمة الآلي متاح للإدارة وعمليات النظام فقط",
      403,
      "TASK_SOURCE_FORBIDDEN",
    );
  }

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

    if (!safeClientId && project.clientId) {
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

  const task = await prisma.$transaction(async (tx) => {
    const createdTask = await tx.task.create({
      data: {
        companyId: user.companyId,
        projectId: safeProjectId,
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
        dueDate: nullableDate(data.dueDate),
        completedAt: data.status === "DONE" ? new Date() : null,
      },
    });

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
          clientId: createdTask.clientId,
          assignedToId: createdTask.assignedToId,
          status: createdTask.status,
          priority: createdTask.priority,
          source: createdTask.source,
        },
      },
    });

    return createdTask;
  });

  return ok({ task }, 201);
}

export const GET = withApiHandler("TASKS_GET_ERROR", getTasks);
export const POST = withApiHandler(
  "TASKS_POST_ERROR",
  createTask,
  "حدث خطأ أثناء إضافة المهمة",
);
