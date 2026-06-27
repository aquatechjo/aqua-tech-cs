import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityAction } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function GET(
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
    return NextResponse.json(
      {
        ok: false,
        message: "المهمة غير موجودة",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    task,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth();
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = updateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "بيانات المهمة غير صحيحة",
      },
      { status: 400 },
    );
  }

  const existingTask = await prisma.task.findFirst({
    where: {
      id,
      companyId: user.companyId,
    },
  });

  if (!existingTask) {
    return NextResponse.json(
      {
        ok: false,
        message: "المهمة غير موجودة",
      },
      { status: 404 },
    );
  }

  const data = parsed.data;

  let safeProjectId =
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
      return NextResponse.json(
        {
          ok: false,
          message: "المشروع المحدد غير موجود",
        },
        { status: 404 },
      );
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
      return NextResponse.json(
        {
          ok: false,
          message: "العميل المحدد غير موجود",
        },
        { status: 404 },
      );
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
      return NextResponse.json(
        {
          ok: false,
          message: "الموظف المحدد غير موجود أو غير فعال",
        },
        { status: 404 },
      );
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

  const task = await prisma.task.update({
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
      ...(data.dueDate !== undefined ? { dueDate: nullableDate(data.dueDate) } : {}),

      ...(data.status === "DONE" && !existingTask.completedAt
        ? { completedAt: new Date() }
        : {}),
      ...(data.status && data.status !== "DONE" ? { completedAt: null } : {}),
    },
  });

  await prisma.activityLog.create({
    data: {
      companyId: user.companyId,
      userId: user.id,
      action,
      entityType: "Task",
      entityId: task.id,
      message: `تم تعديل المهمة: ${task.title}`,
      metadata: {
        taskTitle: task.title,
        projectId: task.projectId,
        clientId: task.clientId,
        assignedToId: task.assignedToId,
        status: task.status,
        priority: task.priority,
        source: task.source,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    task,
  });
}