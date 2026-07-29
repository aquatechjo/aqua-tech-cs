import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  discoveryReportContentSchema,
  normalizeDiscoveryReportContent,
} from "@/lib/discovery-report"
import {
  assertDiscoveryReportReady,
  buildDiscoveryEvidenceSnapshot,
  discoveryEvidenceHash,
  discoveryReportContentHash,
  discoveryReportSessionSelect,
} from "@/lib/discovery-report-server"
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
      ACCESS_ROLES.discoveryReportManagement,
      "لا تملك صلاحية تعديل تقرير الاكتشاف",
    )

    const parsed = discoveryReportContentSchema.safeParse(
      await readJsonBody(request, 64 * 1024),
    )

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ??
          "محتوى تقرير الاكتشاف غير مكتمل",
        400,
        parsed.error.flatten(),
      )
    }

    const content = normalizeDiscoveryReportContent(parsed.data)
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

      const snapshot = buildDiscoveryEvidenceSnapshot(session)
      const evidenceInputHash = discoveryEvidenceHash(snapshot)
      const contentHash = discoveryReportContentHash(content)
      const report = await tx.discoveryReport.upsert({
        where: { intakeSessionId: session.id },
        create: {
          companyId: user.companyId,
          intakeSessionId: session.id,
          createdById: user.id,
        },
        update: {},
      })

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
        include: {
          versions: {
            where: {
              version: report.currentVersion,
            },
            take: 1,
          },
        },
      })

      if (!lockedReport) {
        throw new ApiError(
          "تقرير الاكتشاف غير موجود",
          404,
          "DISCOVERY_REPORT_NOT_FOUND",
        )
      }

      if (
        lockedReport.status === "IN_REVIEW" ||
        lockedReport.status === "APPROVED"
      ) {
        throw new ApiError(
          "التقرير مقفل أثناء المراجعة أو بعد الاعتماد",
          409,
          "DISCOVERY_REPORT_LOCKED",
        )
      }

      if (lockedReport.versions[0]?.contentHash === contentHash) {
        throw new ApiError(
          "لا توجد تعديلات جديدة لحفظ إصدار آخر",
          409,
          "DISCOVERY_REPORT_NO_CHANGES",
        )
      }

      const version = lockedReport.currentVersion + 1

      await tx.discoveryReportVersion.create({
        data: {
          companyId: user.companyId,
          reportId: lockedReport.id,
          createdById: user.id,
          version,
          origin: "HUMAN_REVISION",
          content,
          contentHash,
          evidenceSnapshot: snapshot,
          evidenceInputHash,
        },
      })

      await tx.discoveryReport.update({
        where: { id: lockedReport.id },
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
        action: ActivityAction.DISCOVERY_REPORT_VERSION_CREATED,
        entityType: "DiscoveryReport",
        entityId: lockedReport.id,
        message: `تم حفظ إصدار بشري لتقرير الاكتشاف: ${version}`,
        metadata: {
          intakeSessionId: session.id,
          leadId: session.lead.id,
          version,
          origin: "HUMAN_REVISION",
          evidenceInputHash,
        },
        ...meta,
      })

      return {
        reportId: lockedReport.id,
        status: "DRAFT" as const,
        version,
      }
    })

    return ok(result, 201)
  } catch (error) {
    return handleApiError(
      error,
      "DISCOVERY_REPORT_PATCH_ERROR",
      "تعذر حفظ تقرير الاكتشاف",
    )
  }
}
