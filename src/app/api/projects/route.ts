import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityAction } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const projectSchema = z.object({
  clientId: z.string().optional().nullable(),
  name: z.string().trim().min(2, "اسم المشروع مطلوب"),
  code: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  status: z
    .enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED", "ARCHIVED"])
    .default("PLANNING"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  budget: z.string().trim().optional().nullable(),
  currency: z.string().trim().default("JOD"),
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

export async function GET() {
  const user = await requireAuth();

  const projects = await prisma.project.findMany({
    where: {
      companyId: user.companyId,
    },
    orderBy: {
      createdAt: "desc",
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

  return NextResponse.json({
    ok: true,
    projects,
  });
}

export async function POST(request: Request) {
  const user = await requireAuth();
  const body = await request.json().catch(() => null);

  const parsed = projectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "بيانات المشروع غير صحيحة",
      },
      { status: 400 },
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

  const project = await prisma.project.create({
    data: {
      companyId: user.companyId,
      clientId: data.clientId || null,
      name: data.name,
      code: nullableText(data.code),
      description: nullableText(data.description),
      status: data.status,
      priority: data.priority,
      budget: nullableBudget(data.budget),
      currency: data.currency || "JOD",
      startDate: nullableDate(data.startDate),
      dueDate: nullableDate(data.dueDate),
      completedAt: data.status === "COMPLETED" ? new Date() : null,
    },
  });

  await prisma.activityLog.create({
    data: {
      companyId: user.companyId,
      userId: user.id,
      action: ActivityAction.PROJECT_CREATED,
      entityType: "Project",
      entityId: project.id,
      message: `تم إضافة مشروع جديد: ${project.name}`,
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