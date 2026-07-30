import { z } from "zod"

import type { Prisma } from "@/generated/prisma/client"
import { ActivityAction } from "@/generated/prisma/enums"
import {
  ACCESS_ROLES,
  assertRole,
} from "@/lib/access-control"
import {
  ApiError,
  err,
  handleApiError,
  ok,
} from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getProjectReadinessSnapshot } from "@/lib/project-readiness-server"
import {
  addWorkflowDays,
  parseWorkflowDefinition,
} from "@/lib/project-workflow"
import {
  assertSameOrigin,
  readJsonBody,
} from "@/lib/request-security"
import { dateKeyToUtc } from "@/lib/time"

const moneySchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/,
    "المبلغ يجب أن يكون رقمًا موجبًا بدقة منزلتين",
  )
  .refine((value) => Number(value) > 0, "المبلغ يجب أن يكون أكبر من صفر")

const readinessActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("UPDATE_CONTRACT"),
    contractRequired: z.boolean(),
    contractStatus: z.enum(["PENDING", "SIGNED"]),
    contractReference: z.string().trim().max(300).optional().nullable(),
    contractSignedAt: z.string().date().optional().nullable(),
  }),
  z.object({
    action: z.literal("UPDATE_PAYMENT"),
    paymentRequired: z.boolean(),
    requiredPaymentAmount: moneySchema.optional().nullable(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, "رمز العملة يجب أن يتكون من 3 أحرف")
      .transform((value) => value.toUpperCase()),
  }),
  z.object({
    action: z.literal("GRANT_OVERRIDE"),
    reason: z.string().trim().min(10).max(1000),
  }),
  z.object({
    action: z.literal("REVOKE_OVERRIDE"),
  }),
  z.object({
    action: z.literal("ACTIVATE"),
    startDate: z.string().date(),
    projectLeadEmployeeProfileId: z.string().trim().min(1),
  }),
])

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function lockedProject(
  tx: Prisma.TransactionClient,
  companyId: string,
  projectId: string,
) {
  await tx.$queryRaw`
    SELECT "id"
    FROM "ProjectReadiness"
    WHERE "projectId" = ${projectId}
      AND "companyId" = ${companyId}
    FOR UPDATE
  `

  const project = await tx.project.findFirst({
    where: {
      id: projectId,
      companyId,
    },
    include: {
      readiness: true,
      workflow: true,
    },
  })

  if (!project) {
    throw new ApiError(
      "المشروع غير موجود",
      404,
      "PROJECT_NOT_FOUND",
    )
  }
  const readiness = project.readiness
  if (!readiness) {
    throw new ApiError(
      "بوابة جاهزية المشروع غير موجودة",
      409,
      "PROJECT_READINESS_MISSING",
    )
  }

  return {
    ...project,
    readiness,
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const { id: projectId } = await context.params
    const body = await readJsonBody(request)
    const parsed = readinessActionSchema.safeParse(body)

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ??
          "بيانات بوابة الجاهزية غير صحيحة",
        400,
        {
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten(),
        },
      )
    }

    const action = parsed.data
    const result = await prisma.$transaction(
      async (tx) => {
        const project = await lockedProject(
          tx,
          user.companyId,
          projectId,
        )
        const readiness = project.readiness

        if (action.action !== "ACTIVATE" && readiness.activatedAt) {
          throw new ApiError(
            "تم تفعيل المشروع وأصبحت بوابة الجاهزية سجلًا ثابتًا",
            409,
            "PROJECT_READINESS_LOCKED",
          )
        }

        if (action.action === "UPDATE_CONTRACT") {
          assertRole(
            user.role,
            ACCESS_ROLES.projectReadinessManagement,
            "توثيق عقد المشروع متاح للإدارة والعمليات فقط",
          )
          if (
            action.contractRequired &&
            action.contractStatus === "SIGNED" &&
            (!nullableText(action.contractReference) ||
              !action.contractSignedAt)
          ) {
            throw new ApiError(
              "مرجع العقد وتاريخ توقيعه مطلوبان لتوثيق العقد",
              400,
              "PROJECT_CONTRACT_EVIDENCE_REQUIRED",
            )
          }

          const signed =
            action.contractRequired &&
            action.contractStatus === "SIGNED"
          const updated = await tx.projectReadiness.update({
            where: {
              projectId,
            },
            data: {
              contractRequired: action.contractRequired,
              contractStatus: signed ? "SIGNED" : "PENDING",
              contractReference: signed
                ? nullableText(action.contractReference)
                : null,
              contractSignedAt: signed
                ? dateKeyToUtc(action.contractSignedAt ?? "")
                : null,
              contractVerifiedById: signed ? user.id : null,
              contractVerifiedAt: signed ? new Date() : null,
            },
          })

          await tx.activityLog.create({
            data: {
              companyId: user.companyId,
              userId: user.id,
              action: ActivityAction.PROJECT_READINESS_UPDATED,
              entityType: "ProjectReadiness",
              entityId: updated.id,
              message: `تم تحديث شرط العقد لمشروع ${project.name}`,
              metadata: {
                projectId,
                contractRequired: updated.contractRequired,
                contractStatus: updated.contractStatus,
                contractReference: updated.contractReference,
              },
            },
          })

          return {
            action: action.action,
            replayed: false,
          }
        }

        if (action.action === "UPDATE_PAYMENT") {
          assertRole(
            user.role,
            ACCESS_ROLES.financeManagement,
            "تحديد الدفعة المطلوبة متاح للإدارة المالية فقط",
          )
          if (
            action.paymentRequired &&
            !action.requiredPaymentAmount
          ) {
            throw new ApiError(
              "حدد مبلغ الدفعة المطلوبة قبل تفعيل الشرط",
              400,
              "PROJECT_PAYMENT_AMOUNT_REQUIRED",
            )
          }

          const updated = await tx.projectReadiness.update({
            where: {
              projectId,
            },
            data: {
              paymentRequired: action.paymentRequired,
              requiredPaymentAmount: action.paymentRequired
                ? action.requiredPaymentAmount
                : null,
              currency: action.currency,
              paymentConfiguredById: user.id,
              paymentConfiguredAt: new Date(),
            },
          })

          await tx.activityLog.create({
            data: {
              companyId: user.companyId,
              userId: user.id,
              action: ActivityAction.PROJECT_READINESS_UPDATED,
              entityType: "ProjectReadiness",
              entityId: updated.id,
              message: `تم تحديث شرط الدفعة لمشروع ${project.name}`,
              metadata: {
                projectId,
                paymentRequired: updated.paymentRequired,
                requiredPaymentAmount:
                  updated.requiredPaymentAmount?.toString() ?? null,
                currency: updated.currency,
              },
            },
          })

          return {
            action: action.action,
            replayed: false,
          }
        }

        if (action.action === "GRANT_OVERRIDE") {
          assertRole(
            user.role,
            ACCESS_ROLES.projectReadinessOverride,
            "تجاوز بوابة الجاهزية متاح للمالك أو الإدارة فقط",
          )

          const updated = await tx.projectReadiness.update({
            where: {
              projectId,
            },
            data: {
              overrideReason: action.reason,
              overrideGrantedAt: new Date(),
              overrideGrantedById: user.id,
            },
          })

          await tx.activityLog.create({
            data: {
              companyId: user.companyId,
              userId: user.id,
              action:
                ActivityAction.PROJECT_READINESS_OVERRIDE_GRANTED,
              entityType: "ProjectReadiness",
              entityId: updated.id,
              message: `تم منح تجاوز موثق لبوابة مشروع ${project.name}`,
              metadata: {
                projectId,
                reason: action.reason,
              },
            },
          })

          return {
            action: action.action,
            replayed: false,
          }
        }

        if (action.action === "REVOKE_OVERRIDE") {
          assertRole(
            user.role,
            ACCESS_ROLES.projectReadinessOverride,
            "إلغاء تجاوز بوابة الجاهزية متاح للمالك أو الإدارة فقط",
          )

          if (!readiness.overrideGrantedAt) {
            return {
              action: action.action,
              replayed: true,
            }
          }

          const previousReason = readiness.overrideReason
          const updated = await tx.projectReadiness.update({
            where: {
              projectId,
            },
            data: {
              overrideReason: null,
              overrideGrantedAt: null,
              overrideGrantedById: null,
            },
          })

          await tx.activityLog.create({
            data: {
              companyId: user.companyId,
              userId: user.id,
              action:
                ActivityAction.PROJECT_READINESS_OVERRIDE_REVOKED,
              entityType: "ProjectReadiness",
              entityId: updated.id,
              message: `تم إلغاء تجاوز بوابة مشروع ${project.name}`,
              metadata: {
                projectId,
                previousReason,
              },
            },
          })

          return {
            action: action.action,
            replayed: false,
          }
        }

        assertRole(
          user.role,
          ACCESS_ROLES.projectReadinessManagement,
          "تفعيل المشروع متاح للإدارة والعمليات فقط",
        )

        if (readiness.activatedAt) {
          return {
            action: action.action,
            projectId,
            activatedAt: readiness.activatedAt,
            replayed: true,
          }
        }
        if (!project.workflow) {
          throw new ApiError(
            "سير عمل المشروع غير موجود",
            409,
            "PROJECT_WORKFLOW_MISSING",
          )
        }

        const snapshot = await getProjectReadinessSnapshot(tx, {
          companyId: user.companyId,
          projectId,
          projectStatus: project.status,
          workflowStatus: project.workflow.status,
        })
        if (!snapshot.evaluation.readyToActivate) {
          throw new ApiError(
            snapshot.evaluation.issues[0] ??
              "بوابة المشروع غير جاهزة للتفعيل",
            409,
            "PROJECT_READINESS_BLOCKED",
          )
        }

        const projectLead = await tx.employeeProfile.findFirst({
          where: {
            id: action.projectLeadEmployeeProfileId,
            companyId: user.companyId,
            status: "ACTIVE",
            user: {
              isActive: true,
            },
          },
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
        if (!projectLead) {
          throw new ApiError(
            "قائد المشروع غير موجود أو غير فعال",
            404,
            "PROJECT_LEAD_NOT_FOUND",
          )
        }

        const startedAt = dateKeyToUtc(action.startDate)
        const definition = parseWorkflowDefinition(
          project.workflow.definitionSnapshot,
        )
        const latestDueOffset = Math.max(
          0,
          ...definition.stages.map(
            (stage) => stage.dueOffsetDays ?? 0,
          ),
        )

        await tx.project.update({
          where: {
            id: projectId,
          },
          data: {
            status: "IN_PROGRESS",
            startDate: startedAt,
            dueDate:
              project.dueDate ??
              addWorkflowDays(startedAt, latestDueOffset),
          },
        })
        await tx.projectWorkflow.update({
          where: {
            projectId,
          },
          data: {
            status: "ACTIVE",
            startedAt,
            completedAt: null,
          },
        })

        for (const [index, stage] of definition.stages.entries()) {
          await tx.projectPhase.updateMany({
            where: {
              projectId,
              workflowStageCode: stage.code,
            },
            data: {
              status: index === 0 ? "ACTIVE" : "PLANNED",
              progress: 0,
              startDate: addWorkflowDays(
                startedAt,
                stage.startOffsetDays,
              ),
              dueDate: addWorkflowDays(
                startedAt,
                stage.dueOffsetDays,
              ),
              completedAt: null,
            },
          })
        }

        for (const task of definition.tasks) {
          await tx.task.updateMany({
            where: {
              projectId,
              workflowTaskCode: task.code,
            },
            data: {
              status: "TODO",
              progress: 0,
              dueDate: addWorkflowDays(
                startedAt,
                task.dueOffsetDays,
              ),
              startedAt: null,
              completedAt: null,
            },
          })
        }

        await tx.projectMember.updateMany({
          where: {
            projectId,
            role: "PROJECT_LEAD",
            employeeProfileId: {
              not: projectLead.id,
            },
          },
          data: {
            role: "MANAGER",
          },
        })
        await tx.projectMember.upsert({
          where: {
            projectId_employeeProfileId: {
              projectId,
              employeeProfileId: projectLead.id,
            },
          },
          create: {
            companyId: user.companyId,
            projectId,
            employeeProfileId: projectLead.id,
            role: "PROJECT_LEAD",
            responsibility: "قيادة تنفيذ المشروع",
          },
          update: {
            role: "PROJECT_LEAD",
            responsibility: "قيادة تنفيذ المشروع",
          },
        })

        const activated = await tx.projectReadiness.update({
          where: {
            projectId,
          },
          data: {
            activatedAt: new Date(),
            activatedById: user.id,
          },
        })
        await tx.workflowEvent.create({
          data: {
            companyId: user.companyId,
            workflowId: project.workflow.id,
            event: "PROJECT_STARTED",
            eventKey: "workflow.project.started",
            payload: {
              projectId,
              projectName: project.name,
              startDate: action.startDate,
              projectLeadEmployeeProfileId: projectLead.id,
              projectLeadUserId: projectLead.user.id,
              readinessId: activated.id,
              overrideUsed: Boolean(readiness.overrideGrantedAt),
            },
          },
        })
        await tx.activityLog.create({
          data: {
            companyId: user.companyId,
            userId: user.id,
            action: ActivityAction.PROJECT_STARTED,
            entityType: "Project",
            entityId: projectId,
            message: `تم تفعيل وبدء مشروع ${project.name}`,
            metadata: {
              readinessId: activated.id,
              startDate: action.startDate,
              projectLeadEmployeeProfileId: projectLead.id,
              projectLeadName: projectLead.user.name,
              overrideUsed: Boolean(readiness.overrideGrantedAt),
              paidAmount: snapshot.paidAmount,
              requiredPaymentAmount:
                readiness.requiredPaymentAmount?.toString() ?? null,
              currency: readiness.currency,
            },
          },
        })

        return {
          action: action.action,
          projectId,
          activatedAt: activated.activatedAt,
          replayed: false,
        }
      },
      {
        isolationLevel: "Serializable",
      },
    )

    return ok(result)
  } catch (error) {
    return handleApiError(
      error,
      "PROJECT_READINESS_PATCH_ERROR",
      "حدث خطأ أثناء تحديث بوابة جاهزية المشروع",
    )
  }
}
