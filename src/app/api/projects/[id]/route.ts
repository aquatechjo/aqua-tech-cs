import { z } from "zod";
import { ActivityAction } from "@/generated/prisma/enums";
import { ACCESS_ROLES, assertRole } from "@/lib/access-control";
import { err, handleApiError, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { buildProjectVisibilityWhere } from "@/lib/project-scope";
import { resolveProjectAccessScope } from "@/lib/project-scope-server";
import { prisma } from "@/lib/prisma";
import { assertProjectExecutionActivated } from "@/lib/project-readiness-server";
import { projectStatusToWorkflowStatus } from "@/lib/project-workflow-server";
import { assertSameOrigin, readJsonBody } from "@/lib/request-security";

const optionalDateSchema = z
  .string()
  .refine(
    (value) => value.trim() === "" || !Number.isNaN(Date.parse(value)),
    "صيغة التاريخ غير صحيحة",
  );

const updateProjectSchema = z.object({
  clientId: z.string().optional().nullable(),
  name: z.string().trim().min(2).max(180).optional(),
  code: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z
    .enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED", "ARCHIVED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  budget: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (Number.isFinite(Number(value)) && Number(value) >= 0),
      "الميزانية يجب أن تكون رقمًا موجبًا",
    )
    .optional()
    .nullable(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "رمز العملة يجب أن يتكون من 3 أحرف")
    .transform((value) => value.toUpperCase())
    .optional(),
  startDate: optionalDateSchema.optional().nullable(),
  dueDate: optionalDateSchema.optional().nullable(),
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
    const scope = await resolveProjectAccessScope(user);

    const project = await prisma.project.findFirst({
      where: {
        id,
        companyId: user.companyId,
        ...buildProjectVisibilityWhere(scope),
      },
      select: {
        id: true,
        clientId: true,
        name: true,
        code: true,
        description: true,
        status: true,
        priority: true,
        budget: true,
        currency: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        workflow: {
          select: {
            templateName: true,
            templateCode: true,
            templateVersion: true,
            status: true,
          },
        },
      },
    });

    if (!project) {
      return err("المشروع غير موجود", 404, {
        code: "PROJECT_NOT_FOUND",
      });
    }

    return ok({
      project: {
        ...project,
        budget: scope.canViewProjectBudgets
          ? project.budget
          : null,
      },
    });
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
      "لا تملك صلاحية تعديل بيانات المشروع",
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
    const data = parsed.data;

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

    if (
      data.status &&
      ["IN_PROGRESS", "ON_HOLD", "COMPLETED"].includes(data.status) &&
      existingProject.status !== data.status
    ) {
      if (existingProject.status === "PLANNING") {
        return err(
          "ابدأ المشروع من بوابة الجاهزية بعد توثيق العقد والدفعة وقائد المشروع",
          409,
          {
            code: "PROJECT_READINESS_ACTIVATION_REQUIRED",
          },
        );
      }

      await assertProjectExecutionActivated(prisma, {
        companyId: user.companyId,
        projectId: existingProject.id,
      });
    }

    const startDate =
      data.startDate !== undefined
        ? nullableDate(data.startDate)
        : existingProject.startDate;
    const dueDate =
      data.dueDate !== undefined
        ? nullableDate(data.dueDate)
        : existingProject.dueDate;

    if (startDate && dueDate && dueDate < startDate) {
      return err("تاريخ التسليم يجب أن يكون بعد تاريخ البداية", 400, {
        code: "INVALID_PROJECT_DATES",
      });
    }

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
            ? { startDate }
            : {}),
          ...(data.dueDate !== undefined
            ? { dueDate }
            : {}),
          ...(data.status === "COMPLETED" && !existingProject.completedAt
            ? { completedAt: new Date() }
            : {}),
          ...(data.status && data.status !== "COMPLETED"
            ? { completedAt: null }
            : {}),
        },
      });

      if (data.status !== undefined) {
        const nextWorkflowStatus =
          projectStatusToWorkflowStatus(data.status);
        const workflow = await tx.projectWorkflow.update({
          where: {
            projectId: updatedProject.id,
          },
          data: {
            status: nextWorkflowStatus,
            ...(nextWorkflowStatus === "ACTIVE"
              ? { startedAt: updatedProject.startDate ?? new Date() }
              : {}),
            ...(nextWorkflowStatus === "COMPLETED"
              ? { completedAt: updatedProject.completedAt ?? new Date() }
              : { completedAt: null }),
          },
          select: {
            id: true,
          },
        });

        const event =
          data.status === "COMPLETED" &&
                existingProject.status !== "COMPLETED"
              ? {
                  event: "PROJECT_COMPLETED" as const,
                  eventKey: "workflow.project.completed",
                }
              : null;

        if (event) {
          await tx.workflowEvent.create({
            data: {
              companyId: user.companyId,
              workflowId: workflow.id,
              event: event.event,
              eventKey: event.eventKey,
              payload: {
                projectId: updatedProject.id,
                projectName: updatedProject.name,
                status: updatedProject.status,
              },
            },
          });
        }
      }

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
