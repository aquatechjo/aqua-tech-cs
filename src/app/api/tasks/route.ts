import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityAction } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function GET() {
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

  return NextResponse.json({
    ok: true,
    tasks,
  });
}

export async function POST(request: Request) {
  const user = await requireAuth();
  const body = await request.json().catch(() => null);

  const parsed = taskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "بيانات المهمة غير صحيحة",
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  let safeProjectId: string | null = data.projectId || null;
  let safeClientId: string | null = data.clientId || null;
  let safeAssignedToId: string | null = data.assignedToId || null;

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

  const task = await prisma.task.create({
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

  await prisma.activityLog.create({
    data: {
      companyId: user.companyId,
      userId: user.id,
      action: ActivityAction.TASK_CREATED,
      entityType: "Task",
      entityId: task.id,
      message: `تم إضافة مهمة جديدة: ${task.title}`,
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