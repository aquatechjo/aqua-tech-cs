import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityAction } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateProjectSchema = z.object({
  clientId: z.string().optional().nullable(),
  name: z.string().trim().min(2).optional(),
  code: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  status: z
    .enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED", "ARCHIVED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  budget: z.string().trim().optional().nullable(),
  currency: z.string().trim().optional(),
  startDate: z.string().optional().nullable(),
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

function nullableBudget(value: string | null | undefined) {
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
    },
  });

  if (!project) {
    return NextResponse.json(
      {
        ok: false,
        message: "المشروع غير موجود",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    project,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth();
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = updateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "بيانات المشروع غير صحيحة",
      },
      { status: 400 },
    );
  }

  const existingProject = await prisma.project.findFirst({
    where: {
      id,
      companyId: user.companyId,
    },
  });

  if (!existingProject) {
    return NextResponse.json(
      {
        ok: false,
        message: "المشروع غير موجود",
      },
      { status: 404 },
    );
  }

  const data = parsed.data;

  if (data.clientId) {
    const client = await prisma.client.findFirst({
      where: {
        id: data.clientId,
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

  let action: ActivityAction = ActivityAction.PROJECT_UPDATED;

  if (data.status === "ARCHIVED" && existingProject.status !== "ARCHIVED") {
    action = ActivityAction.PROJECT_ARCHIVED;
  }

  if (existingProject.status === "ARCHIVED" && data.status && data.status !== "ARCHIVED") {
    action = ActivityAction.PROJECT_RESTORED;
  }

  if (data.status === "COMPLETED" && existingProject.status !== "COMPLETED") {
    action = ActivityAction.PROJECT_COMPLETED;
  }

  const project = await prisma.project.update({
    where: {
      id: existingProject.id,
    },
    data: {
      ...(data.clientId !== undefined ? { clientId: data.clientId || null } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.code !== undefined ? { code: nullableText(data.code) } : {}),
      ...(data.description !== undefined
        ? { description: nullableText(data.description) }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.budget !== undefined ? { budget: nullableBudget(data.budget) } : {}),
      ...(data.currency !== undefined ? { currency: data.currency || "JOD" } : {}),
      ...(data.startDate !== undefined ? { startDate: nullableDate(data.startDate) } : {}),
      ...(data.dueDate !== undefined ? { dueDate: nullableDate(data.dueDate) } : {}),
      ...(data.status === "COMPLETED" && !existingProject.completedAt
        ? { completedAt: new Date() }
        : {}),
      ...(data.status && data.status !== "COMPLETED" ? { completedAt: null } : {}),
    },
  });

  await prisma.activityLog.create({
    data: {
      companyId: user.companyId,
      userId: user.id,
      action,
      entityType: "Project",
      entityId: project.id,
      message: `تم تعديل المشروع: ${project.name}`,
      metadata: {
        projectName: project.name,
        clientId: project.clientId,
        status: project.status,
        priority: project.priority,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    project,
  });
}