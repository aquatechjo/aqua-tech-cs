import { z } from "zod";
import { ActivityAction } from "@/generated/prisma/enums";
import { ACCESS_ROLES, assertRole } from "@/lib/access-control";
import { err, handleApiError, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProjectWithWorkflow } from "@/lib/project-workflow-server";
import { buildProjectVisibilityWhere } from "@/lib/project-scope";
import { resolveProjectAccessScope } from "@/lib/project-scope-server";
import { assertSameOrigin, readJsonBody } from "@/lib/request-security";

const optionalDateSchema = z
  .string()
  .refine(
    (value) => value.trim() === "" || !Number.isNaN(Date.parse(value)),
    "صيغة التاريخ غير صحيحة",
  );

const projectSchema = z.object({
  workflowTemplateId: z
    .string()
    .trim()
    .min(1, "قالب سير العمل مطلوب"),
  clientId: z.string().optional().nullable(),
  name: z.string().trim().min(2, "اسم المشروع مطلوب").max(180),
  code: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z
    .enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED", "ARCHIVED"])
    .default("PLANNING"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
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
    .default("JOD"),
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

export async function GET() {
  try {
    const user = await requireAuth();
    const scope = await resolveProjectAccessScope(user);

    const projects = await prisma.project.findMany({
      where: {
        companyId: user.companyId,
        ...buildProjectVisibilityWhere(scope),
      },
      orderBy: {
        createdAt: "desc",
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

    return ok({
      projects: projects.map((project) => ({
        ...project,
        budget: scope.canViewProjectBudgets
          ? project.budget
          : null,
      })),
    });
  } catch (error) {
    return handleApiError(error, "PROJECTS_GET_ERROR");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const user = await requireAuth();

    assertRole(
      user.role,
      ACCESS_ROLES.projectManagement,
      "لا تملك صلاحية إضافة المشاريع",
    );

    const body = await readJsonBody(request);

    const parsed = projectSchema.safeParse(body);

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ?? "بيانات المشروع غير صحيحة",
        400,
        { code: "VALIDATION_ERROR", details: parsed.error.flatten() },
      );
    }

    const data = parsed.data;
    const startDate = nullableDate(data.startDate);
    const dueDate = nullableDate(data.dueDate);

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

    const project = await prisma.$transaction(async (tx) => {
      const created = await createProjectWithWorkflow(tx, {
        companyId: user.companyId,
        createdById: user.id,
        workflowTemplateId: data.workflowTemplateId,
        project: {
          clientId: data.clientId || null,
          name: data.name,
          code: nullableText(data.code),
          description: nullableText(data.description),
          status: data.status,
          priority: data.priority,
          budget: nullableBudget(data.budget),
          currency: data.currency || "JOD",
          startDate,
          dueDate,
          completedAt: data.status === "COMPLETED" ? new Date() : null,
        },
      });
      const createdProject = created.project;

      await tx.activityLog.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.PROJECT_CREATED,
          entityType: "Project",
          entityId: createdProject.id,
          message: `تم إضافة مشروع جديد: ${createdProject.name}`,
          metadata: {
            projectName: createdProject.name,
            clientId: createdProject.clientId,
            status: createdProject.status,
            priority: createdProject.priority,
            workflowTemplateId: created.template.id,
            workflowTemplateCode: created.template.code,
          },
        },
      });

      return {
        ...createdProject,
        workflow: {
          id: created.workflow.id,
          templateName: created.workflow.templateName,
          templateCode: created.workflow.templateCode,
          templateVersion: created.workflow.templateVersion,
          status: created.workflow.status,
        },
      };
    });

    return ok({ project }, 201);
  } catch (error) {
    return handleApiError(
      error,
      "PROJECTS_POST_ERROR",
      "حدث خطأ أثناء إضافة المشروع",
    );
  }
}
