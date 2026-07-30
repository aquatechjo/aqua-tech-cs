import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  normalizePricingContent,
  pricingDraftInputSchema,
} from "@/lib/pricing"
import {
  assertPricingSourceReady,
  pricingContentHash,
} from "@/lib/pricing-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.pricingManagement,
      "لا تملك صلاحية إعداد التسعير",
    )

    const parsed = pricingDraftInputSchema.safeParse(
      await readJsonBody(request, 128 * 1024),
    )

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ?? "بيانات التسعير غير مكتملة",
        400,
        parsed.error.flatten(),
      )
    }

    let content

    try {
      content = normalizePricingContent(parsed.data)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "PRICING_DISCOUNT_EXCEEDS_SUBTOTAL"
      ) {
        throw new ApiError(
          "قيمة الخصم لا يمكن أن تتجاوز مجموع البنود الظاهرة للعميل",
          400,
          "PRICING_DISCOUNT_EXCEEDS_SUBTOTAL",
        )
      }
      if (
        error instanceof Error &&
        error.message === "PRICING_TOTAL_TOO_LARGE"
      ) {
        throw new ApiError(
          "إجمالي التسعير يتجاوز الحد المالي المدعوم",
          400,
          "PRICING_TOTAL_TOO_LARGE",
        )
      }
      throw error
    }

    const { id } = await params
    const meta = await getRequestMeta()
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

      const report = session.report

      if (!report) {
        throw new ApiError(
          "تقرير الاكتشاف غير موجود",
          404,
          "DISCOVERY_REPORT_NOT_FOUND",
        )
      }

      const reportVersion = await tx.discoveryReportVersion.findUnique({
        where: {
          reportId_version: {
            reportId: report.id,
            version: report.currentVersion,
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

      const workspace = await tx.pricingWorkspace.upsert({
        where: {
          intakeSessionId: session.id,
        },
        create: {
          companyId: user.companyId,
          intakeSessionId: session.id,
          discoveryReportId: report.id,
          opportunityId: session.opportunity?.id ?? null,
          createdById: user.id,
        },
        update: {
          opportunityId: session.opportunity?.id ?? null,
        },
      })

      await tx.$queryRaw`
        SELECT "id"
        FROM "PricingWorkspace"
        WHERE "id" = ${workspace.id}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const lockedWorkspace = await tx.pricingWorkspace.findFirst({
        where: {
          id: workspace.id,
          companyId: user.companyId,
        },
        include: {
          versions: {
            where: {
              version: workspace.currentVersion,
            },
            take: 1,
          },
        },
      })

      if (!lockedWorkspace) {
        throw new ApiError(
          "مساحة التسعير غير موجودة",
          404,
          "PRICING_WORKSPACE_NOT_FOUND",
        )
      }

      if (
        lockedWorkspace.status === "IN_REVIEW" ||
        lockedWorkspace.status === "APPROVED"
      ) {
        throw new ApiError(
          "التسعير مقفل أثناء المراجعة أو بعد الاعتماد",
          409,
          "PRICING_WORKSPACE_LOCKED",
        )
      }

      const contentHash = pricingContentHash(content)

      if (lockedWorkspace.versions[0]?.contentHash === contentHash) {
        throw new ApiError(
          "لا توجد تعديلات جديدة لحفظ إصدار آخر",
          409,
          "PRICING_NO_CHANGES",
        )
      }

      const version = lockedWorkspace.currentVersion + 1

      await tx.pricingVersion.create({
        data: {
          companyId: user.companyId,
          workspaceId: lockedWorkspace.id,
          createdById: user.id,
          version,
          content,
          contentHash,
          discoveryReportVersion: reportVersion.version,
          discoveryContentHash: reportVersion.contentHash,
        },
      })

      await tx.pricingWorkspace.update({
        where: {
          id: lockedWorkspace.id,
        },
        data: {
          status: "DRAFT",
          currentVersion: version,
          reviewNotes: null,
          submittedAt: null,
          reviewedById: null,
          approvedAt: null,
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PRICING_VERSION_CREATED,
        entityType: "PricingWorkspace",
        entityId: lockedWorkspace.id,
        message: `تم حفظ إصدار تسعير بشري: ${version}`,
        metadata: {
          intakeSessionId: session.id,
          leadId: session.lead.id,
          opportunityId: session.opportunity?.id ?? null,
          discoveryReportId: report.id,
          discoveryReportVersion: reportVersion.version,
          version,
          currency: content.currency,
          clientSubtotal: content.totals.clientSubtotal,
          grandTotal: content.totals.grandTotal,
          marginPercent: content.totals.marginPercent,
        },
        ...meta,
      })

      return {
        workspaceId: lockedWorkspace.id,
        status: "DRAFT" as const,
        version,
        totals: content.totals,
      }
    })

    return ok(result, 201)
  } catch (error) {
    return handleApiError(
      error,
      "PRICING_PATCH_ERROR",
      "تعذر حفظ إصدار التسعير",
    )
  }
}
