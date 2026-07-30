import { z } from "zod"

import { ActivityAction } from "@/generated/prisma/enums"
import {
  ACCESS_ROLES,
  assertCanApprovePricing,
  assertRole,
} from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { pricingVersionContentSchema } from "@/lib/pricing"
import {
  assertPricingSourceReady,
  assertPricingVersionMatchesReport,
} from "@/lib/pricing-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const reviewPricingSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SUBMIT"),
  }),
  z.object({
    action: z.literal("REQUEST_CHANGES"),
    notes: z.string().trim().min(10).max(4000),
  }),
  z.object({
    action: z.literal("APPROVE"),
  }),
])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    const parsed = reviewPricingSchema.safeParse(
      await readJsonBody(request),
    )

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ??
          "إجراء مراجعة التسعير غير صحيح",
        400,
        parsed.error.flatten(),
      )
    }

    assertRole(
      user.role,
      parsed.data.action === "SUBMIT"
        ? ACCESS_ROLES.pricingManagement
        : ACCESS_ROLES.pricingApproval,
      "لا تملك صلاحية تنفيذ إجراء مراجعة التسعير",
    )

    const { id } = await params
    const meta = await getRequestMeta()
    const now = new Date()
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "IntakeSession"
        WHERE "id" = ${id}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const session = await tx.intakeSession.findFirst({
        where: {
          id,
          companyId: user.companyId,
        },
        select: {
          id: true,
          status: true,
          lead: {
            select: {
              id: true,
            },
          },
          opportunity: {
            select: {
              id: true,
            },
          },
          report: {
            select: {
              id: true,
              status: true,
              currentVersion: true,
            },
          },
          pricingWorkspace: {
            select: {
              id: true,
            },
          },
        },
      })

      if (!session) {
        throw new ApiError(
          "جلسة الاكتشاف غير موجودة",
          404,
          "DISCOVERY_SESSION_NOT_FOUND",
        )
      }

      assertPricingSourceReady({
        sessionStatus: session.status,
        reportStatus: session.report?.status ?? null,
        reportVersion: session.report?.currentVersion ?? 0,
      })

      if (!session.report || !session.pricingWorkspace) {
        throw new ApiError(
          "احفظ إصدار تسعير أولًا",
          409,
          "PRICING_VERSION_REQUIRED",
        )
      }

      const reportVersion = await tx.discoveryReportVersion.findUnique({
        where: {
          reportId_version: {
            reportId: session.report.id,
            version: session.report.currentVersion,
          },
        },
        select: {
          version: true,
          contentHash: true,
        },
      })

      if (!reportVersion) {
        throw new ApiError(
          "إصدار تقرير الاكتشاف المعتمد غير موجود",
          404,
          "DISCOVERY_REPORT_VERSION_NOT_FOUND",
        )
      }

      await tx.$queryRaw`
        SELECT "id"
        FROM "PricingWorkspace"
        WHERE "id" = ${session.pricingWorkspace.id}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const workspace = await tx.pricingWorkspace.findFirst({
        where: {
          id: session.pricingWorkspace.id,
          companyId: user.companyId,
        },
      })

      if (!workspace || workspace.currentVersion < 1) {
        throw new ApiError(
          "احفظ إصدار تسعير أولًا",
          409,
          "PRICING_VERSION_REQUIRED",
        )
      }

      const currentVersion = await tx.pricingVersion.findUnique({
        where: {
          workspaceId_version: {
            workspaceId: workspace.id,
            version: workspace.currentVersion,
          },
        },
      })

      if (!currentVersion) {
        throw new ApiError(
          "إصدار التسعير الحالي غير موجود",
          404,
          "PRICING_VERSION_NOT_FOUND",
        )
      }

      const contentResult = pricingVersionContentSchema.safeParse(
        currentVersion.content,
      )

      if (!contentResult.success) {
        throw new ApiError(
          "إصدار التسعير الحالي لا يطابق عقد البيانات",
          409,
          "PRICING_VERSION_INVALID",
        )
      }

      const content = contentResult.data

      assertPricingVersionMatchesReport({
        versionReportVersion: currentVersion.discoveryReportVersion,
        versionContentHash: currentVersion.discoveryContentHash,
        reportVersion: reportVersion.version,
        reportContentHash: reportVersion.contentHash,
      })

      let nextStatus = workspace.status
      let action: ActivityAction
      let message: string

      if (parsed.data.action === "SUBMIT") {
        if (
          workspace.status !== "DRAFT" &&
          workspace.status !== "CHANGES_REQUESTED"
        ) {
          throw new ApiError(
            "حالة التسعير لا تسمح بإرساله للمراجعة",
            409,
            "PRICING_INVALID_TRANSITION",
          )
        }

        if (Number(content.totals.clientSubtotal) <= 0) {
          throw new ApiError(
            "يجب تسعير بند ظاهر للعميل بقيمة أكبر من صفر قبل المراجعة",
            409,
            "PRICING_CLIENT_VALUE_REQUIRED",
          )
        }

        nextStatus = "IN_REVIEW"
        action = ActivityAction.PRICING_SUBMITTED
        message = `تم إرسال التسعير للمراجعة: الإصدار ${currentVersion.version}`

        await tx.pricingWorkspace.update({
          where: {
            id: workspace.id,
          },
          data: {
            status: nextStatus,
            submittedAt: now,
            reviewNotes: null,
            reviewedById: null,
          },
        })
      } else if (parsed.data.action === "REQUEST_CHANGES") {
        if (workspace.status !== "IN_REVIEW") {
          throw new ApiError(
            "يمكن طلب التعديلات من تسعير قيد المراجعة فقط",
            409,
            "PRICING_INVALID_TRANSITION",
          )
        }

        nextStatus = "CHANGES_REQUESTED"
        action = ActivityAction.PRICING_CHANGES_REQUESTED
        message = `طُلب تعديل التسعير: الإصدار ${currentVersion.version}`

        await tx.pricingWorkspace.update({
          where: {
            id: workspace.id,
          },
          data: {
            status: nextStatus,
            reviewNotes: parsed.data.notes,
            reviewedById: user.id,
            changesRequestedAt: now,
          },
        })
      } else {
        if (workspace.status !== "IN_REVIEW") {
          throw new ApiError(
            "يمكن اعتماد تسعير قيد المراجعة فقط",
            409,
            "PRICING_INVALID_TRANSITION",
          )
        }

        assertCanApprovePricing(user, currentVersion.createdById)

        nextStatus = "APPROVED"
        action = ActivityAction.PRICING_APPROVED
        message = `تم اعتماد التسعير: الإصدار ${currentVersion.version}`

        await tx.pricingWorkspace.update({
          where: {
            id: workspace.id,
          },
          data: {
            status: nextStatus,
            reviewedById: user.id,
            reviewNotes: null,
            approvedAt: now,
          },
        })

        await tx.lead.update({
          where: {
            id: session.lead.id,
          },
          data: {
            nextAction: "إنشاء العرض المركزي من التسعير المعتمد",
            nextActionAt: null,
          },
        })

        if (session.opportunity) {
          await tx.salesOpportunity.update({
            where: {
              id: session.opportunity.id,
            },
            data: {
              estimatedValue: content.totals.grandTotal,
              currency: content.currency,
            },
          })
        }
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action,
        entityType: "PricingWorkspace",
        entityId: workspace.id,
        message,
        metadata: {
          intakeSessionId: session.id,
          leadId: session.lead.id,
          opportunityId: session.opportunity?.id ?? null,
          discoveryReportId: session.report.id,
          discoveryReportVersion: reportVersion.version,
          version: currentVersion.version,
          previousStatus: workspace.status,
          status: nextStatus,
          currency: content.currency,
          grandTotal: content.totals.grandTotal,
          grossProfit: content.totals.grossProfit,
          marginPercent: content.totals.marginPercent,
        },
        ...meta,
      })

      return {
        workspaceId: workspace.id,
        status: nextStatus,
        version: currentVersion.version,
        proposalReady: nextStatus === "APPROVED",
      }
    })

    return ok(result)
  } catch (error) {
    return handleApiError(
      error,
      "PRICING_REVIEW_ERROR",
      "تعذر تنفيذ مراجعة التسعير",
    )
  }
}
