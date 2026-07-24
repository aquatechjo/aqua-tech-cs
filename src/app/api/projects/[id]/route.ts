import { z } from "zod";
import { ActivityAction } from "@/generated/prisma/enums";
import { ACCESS_ROLES, assertRole } from "@/lib/access-control";
import { err, handleApiError, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, readJsonBody } from "@/lib/request-security";

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
  try {
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
      return err("المشروع غير موجود", 404, {
        code: "PROJECT_NOT_FOUND",
      });
    }

    return ok({ project });
  } catch (error) {
    return handleApiError(error, "PROJECT_GET_ERROR");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);

    const user = await requireAuth();

    assertRole(
      user.role,
      ACCESS_ROLES.projectManagement,
      "لا تملك صلاحية تعديل المشاريع",
    );

    const { id } = await context.params;
    const body = await readJsonBody(request);
    const parsed = updateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ?? "بيانات المشروع غير صحيحة",
        400,
        { code: "VALIDATION_ERROR", details: parsed.error.flatten() },
      );
    }

    const existingProject = await prisma.project.findFirst({
      where: {
        id,
        companyId: user.companyId,
      },
    });

    if (!existingProject) {
      return err("المشروع غير موجود", 404, {
        code: "PROJECT_NOT_FOUND",
      });
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
        return err("العميل المحدد غير موجود", 404, {
          code: "CLIENT_NOT_FOUND",
        });
      }
    }

    let action: ActivityAction = ActivityAction.PROJECT_UPDATED;

    if (data.status === "ARCHIVED" && existingProject.status !== "ARCHIVED") {
      action = ActivityAction.PROJECT_ARCHIVED;
    }

    if (
      existingProject.status === "ARCHIVED" &&
      data.status &&
      data.status !== "ARCHIVED"
    ) {
      action = ActivityAction.PROJECT_RESTORED;
    }

    if (data.status === "COMPLETED" && existingProject.status !== "COMPLETED") {
      action = ActivityAction.PROJECT_COMPLETED;
    }

    const project = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: {
          id: existingProject.id,
        },
        data: {
          ...(data.clientId !== undefined
            ? { clientId: data.clientId || null }
            : {}),
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.code !== undefined ? { code: nullableText(data.code) } : {}),
          ...(data.description !== undefined
            ? { description: nullableText(data.description) }
            : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.priority !== undefined ? { priority: data.priority } : {}),
          ...(data.budget !== undefined
            ? { budget: nullableBudget(data.budget) }
            : {}),
          ...(data.currency !== undefined
            ? { currency: data.currency || "JOD" }
            : {}),
          ...(data.startDate !== undefined
            ? { startDate: nullableDate(data.startDate) }
            : {}),
          ...(data.dueDate !== undefined
            ? { dueDate: nullableDate(data.dueDate) }
            : {}),
          ...(data.status === "COMPLETED" && !existingProject.completedAt
            ? { completedAt: new Date() }
            : {}),
          ...(data.status && data.status !== "COMPLETED"
            ? { completedAt: null }
            : {}),
        },
      });

      await tx.activityLog.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          action,
          entityType: "Project",
          entityId: updatedProject.id,
          message: `تم تعديل المشروع: ${updatedProject.name}`,
          metadata: {
            projectName: updatedProject.name,
            clientId: updatedProject.clientId,
            status: updatedProject.status,
            priority: updatedProject.priority,
          },
        },
      });

      return updatedProject;
    });

    return ok({ project });
  } catch (error) {
    return handleApiError(
      error,
      "PROJECT_PATCH_ERROR",
      "حدث خطأ أثناء تعديل المشروع",
    );
  }
}
