import { z } from "zod"

import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  assertDiscoveryReportReady,
  buildDiscoveryEvidenceSnapshot,
  discoveryEvidenceHash,
  discoveryReportSessionSelect,
} from "@/lib/discovery-report-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const reviewReportSchema = z.discriminatedUnion("action", [
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
    const parsed = reviewReportSchema.safeParse(
      await readJsonBody(request),
    )

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ??
          "إجراء مراجعة التقرير غير صحيح",
        400,
        parsed.error.flatten(),
      )
    }

    assertRole(
      user.role,
      parsed.data.action === "SUBMIT"
        ? ACCESS_ROLES.discoveryReportManagement
        : ACCESS_ROLES.discoveryReportApproval,
      "لا تملك صلاحية تنفيذ إجراء مراجعة التقرير",
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
        select: discoveryReportSessionSelect,
      })

      if (!session) {
        throw new ApiError(
          "جلسة الاكتشاف غير موجودة",
          404,
          "DISCOVERY_SESSION_NOT_FOUND",
        )
      }

      assertDiscoveryReportReady(session)

      const report = await tx.discoveryReport.findFirst({
        where: {
          intakeSessionId: session.id,
          companyId: user.companyId,
        },
      })

      if (!report || report.currentVersion < 1) {
        throw new ApiError(
          "أنشئ واحفظ إصدارًا بشريًا من التقرير أولًا",
          409,
          "DISCOVERY_REPORT_VERSION_REQUIRED",
        )
      }

      await tx.$queryRaw`
        SELECT "id"
        FROM "DiscoveryReport"
        WHERE "id" = ${report.id}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const lockedReport = await tx.discoveryReport.findFirst({
        where: {
          id: report.id,
          companyId: user.companyId,
        },
      })
      const currentVersion = await tx.discoveryReportVersion.findUnique({
        where: {
          reportId_version: {
            reportId: report.id,
            version: report.currentVersion,
          },
        },
      })

      if (!lockedReport || !currentVersion) {
        throw new ApiError(
          "إصدار تقرير الاكتشاف غير موجود",
          404,
          "DISCOVERY_REPORT_VERSION_NOT_FOUND",
        )
      }

      const currentEvidenceHash = discoveryEvidenceHash(
        buildDiscoveryEvidenceSnapshot(session),
      )

      if (
        currentVersion.evidenceInputHash !== currentEvidenceHash
      ) {
        throw new ApiError(
          "تغيرت إجابات الاكتشاف بعد حفظ هذا الإصدار. احفظ إصدارًا بشريًا جديدًا قبل المراجعة.",
          409,
          "DISCOVERY_REPORT_STALE",
        )
      }

      if (
        parsed.data.action !== "REQUEST_CHANGES" &&
        currentVersion.origin !== "HUMAN_REVISION"
      ) {
        throw new ApiError(
          "يجب أن يراجع موظف المسودة ويحفظ إصدارًا بشريًا قبل إرسالها أو اعتمادها",
          409,
          "DISCOVERY_REPORT_HUMAN_REVISION_REQUIRED",
        )
      }

      let nextStatus = lockedReport.status
      let action: ActivityAction
      let message: string

      if (parsed.data.action === "SUBMIT") {
        if (
          lockedReport.status !== "DRAFT" &&
          lockedReport.status !== "CHANGES_REQUESTED"
        ) {
          throw new ApiError(
            "حالة التقرير لا تسمح بإرساله للمراجعة",
            409,
            "DISCOVERY_REPORT_INVALID_TRANSITION",
          )
        }

        nextStatus = "IN_REVIEW"
        action = ActivityAction.DISCOVERY_REPORT_SUBMITTED
        message = `تم إرسال تقرير الاكتشاف للمراجعة: الإصدار ${currentVersion.version}`

        await tx.discoveryReport.update({
          where: { id: lockedReport.id },
          data: {
            status: nextStatus,
            submittedAt: now,
            reviewNotes: null,
            reviewedById: null,
          },
        })
      } else if (parsed.data.action === "REQUEST_CHANGES") {
        if (lockedReport.status !== "IN_REVIEW") {
          throw new ApiError(
            "يمكن طلب التعديلات من تقرير قيد المراجعة فقط",
            409,
            "DISCOVERY_REPORT_INVALID_TRANSITION",
          )
        }

        nextStatus = "CHANGES_REQUESTED"
        action = ActivityAction.DISCOVERY_REPORT_CHANGES_REQUESTED
        message = `طُلب تعديل تقرير الاكتشاف: الإصدار ${currentVersion.version}`

        await tx.discoveryReport.update({
          where: { id: lockedReport.id },
          data: {
            status: nextStatus,
            reviewNotes: parsed.data.notes,
            reviewedById: user.id,
            changesRequestedAt: now,
          },
        })
      } else {
        if (lockedReport.status !== "IN_REVIEW") {
          throw new ApiError(
            "يمكن اعتماد تقرير قيد المراجعة فقط",
            409,
            "DISCOVERY_REPORT_INVALID_TRANSITION",
          )
        }

        nextStatus = "APPROVED"
        action = ActivityAction.DISCOVERY_REPORT_APPROVED
        message = `تم اعتماد تقرير الاكتشاف: الإصدار ${currentVersion.version}`

        await tx.discoveryReport.update({
          where: { id: lockedReport.id },
          data: {
            status: nextStatus,
            reviewedById: user.id,
            reviewNotes: null,
            approvedAt: now,
          },
        })

        await tx.intakeSession.update({
          where: { id: session.id },
          data: {
            status: "COMPLETED",
            completedAt: now,
            publicAccessTokenHash: null,
            publicAccessRevokedAt: now,
            updatedById: user.id,
          },
        })

        if (
          session.lead.status !== "QUALIFIED" &&
          session.lead.status !== "CONVERTED"
        ) {
          await tx.lead.update({
            where: { id: session.lead.id },
            data: {
              status: "QUALIFIED",
              qualifiedAt: now,
              nextAction: "مراجعة النطاق وإعداد التسعير",
              nextActionAt: null,
            },
          })
        }

        if (
          session.opportunity &&
          (session.opportunity.stage === "NEW" ||
            session.opportunity.stage === "DISCOVERY")
        ) {
          await tx.salesOpportunity.update({
            where: { id: session.opportunity.id },
            data: {
              stage: "QUALIFIED",
              probability: 50,
            },
          })
        }
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action,
        entityType: "DiscoveryReport",
        entityId: lockedReport.id,
        message,
        metadata: {
          intakeSessionId: session.id,
          leadId: session.lead.id,
          opportunityId: session.opportunity?.id ?? null,
          version: currentVersion.version,
          previousStatus: lockedReport.status,
          status: nextStatus,
          evidenceInputHash: currentEvidenceHash,
        },
        ...meta,
      })

      return {
        reportId: lockedReport.id,
        status: nextStatus,
        version: currentVersion.version,
        discoveryCompleted: nextStatus === "APPROVED",
      }
    })

    return ok(result)
  } catch (error) {
    return handleApiError(
      error,
      "DISCOVERY_REPORT_REVIEW_ERROR",
      "تعذر تنفيذ مراجعة تقرير الاكتشاف",
    )
  }
}
