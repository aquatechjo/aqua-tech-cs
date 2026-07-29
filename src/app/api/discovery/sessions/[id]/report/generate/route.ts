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
  discoveryReportContentHash,
  discoveryReportSessionSelect,
  generateDiscoveryReportWithOpenAi,
} from "@/lib/discovery-report-server"
import { prisma } from "@/lib/prisma"
import { enforceRateLimit } from "@/lib/rate-limit"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const generateReportSchema = z.object({
  confirmExternalAiProcessing: z.literal(true),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.discoveryReportManagement,
      "لا تملك صلاحية توليد تقرير الاكتشاف",
    )

    const parsed = generateReportSchema.safeParse(
      await readJsonBody(request),
    )

    if (!parsed.success) {
      return err(
        "يلزم تأكيد السماح بالمعالجة الخارجية قبل التوليد",
        400,
        parsed.error.flatten(),
      )
    }

    const { id } = await params

    await enforceRateLimit({
      namespace: "discovery-report-ai",
      identifier: `${user.companyId}:${id}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })

    const session = await prisma.intakeSession.findFirst({
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

    const existingReport = await prisma.discoveryReport.findUnique({
      where: { intakeSessionId: session.id },
      select: {
        status: true,
      },
    })

    if (
      existingReport?.status === "IN_REVIEW" ||
      existingReport?.status === "APPROVED"
    ) {
      throw new ApiError(
        "لا يمكن إعادة التوليد أثناء المراجعة أو بعد الاعتماد",
        409,
        "DISCOVERY_REPORT_LOCKED",
      )
    }

    const snapshot = buildDiscoveryEvidenceSnapshot(session)
    const evidenceInputHash = discoveryEvidenceHash(snapshot)
    const generated = await generateDiscoveryReportWithOpenAi({
      snapshot,
      companyId: user.companyId,
      userId: user.id,
    })
    const meta = await getRequestMeta()
    const now = new Date()
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "IntakeSession"
        WHERE "id" = ${session.id}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const currentSession = await tx.intakeSession.findFirst({
        where: {
          id: session.id,
          companyId: user.companyId,
        },
        select: discoveryReportSessionSelect,
      })

      if (!currentSession) {
        throw new ApiError(
          "جلسة الاكتشاف غير موجودة",
          404,
          "DISCOVERY_SESSION_NOT_FOUND",
        )
      }

      assertDiscoveryReportReady(currentSession)

      const currentSnapshot =
        buildDiscoveryEvidenceSnapshot(currentSession)
      const currentEvidenceHash =
        discoveryEvidenceHash(currentSnapshot)

      if (currentEvidenceHash !== evidenceInputHash) {
        throw new ApiError(
          "تغيرت أدلة الجلسة أثناء التوليد. راجع الإجابات ثم أعد المحاولة.",
          409,
          "DISCOVERY_REPORT_INPUT_CHANGED",
        )
      }

      const report = await tx.discoveryReport.upsert({
        where: {
          intakeSessionId: currentSession.id,
        },
        create: {
          companyId: user.companyId,
          intakeSessionId: currentSession.id,
          createdById: user.id,
          aiAuthorizedById: user.id,
          aiAuthorizedAt: now,
        },
        update: {
          aiAuthorizedById: user.id,
          aiAuthorizedAt: now,
        },
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
          "تغيرت حالة التقرير ولم يعد يقبل التوليد",
          409,
          "DISCOVERY_REPORT_LOCKED",
        )
      }

      const version = lockedReport.currentVersion + 1
      const reportVersion = await tx.discoveryReportVersion.create({
        data: {
          companyId: user.companyId,
          reportId: lockedReport.id,
          createdById: user.id,
          version,
          origin: "AI_DRAFT",
          content: generated.content,
          contentHash: discoveryReportContentHash(generated.content),
          evidenceSnapshot: currentSnapshot,
          evidenceInputHash: currentEvidenceHash,
          promptVersion: snapshot.contractVersion,
          aiProvider: "OPENAI",
          aiModel: generated.model,
          aiResponseId: generated.responseId,
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
        action: ActivityAction.DISCOVERY_REPORT_AI_GENERATED,
        entityType: "DiscoveryReport",
        entityId: lockedReport.id,
        message: `تم توليد مسودة تقرير اكتشاف بالإصدار ${version}`,
        metadata: {
          intakeSessionId: currentSession.id,
          leadId: currentSession.lead.id,
          version,
          origin: reportVersion.origin,
          model: generated.model,
          promptVersion: snapshot.contractVersion,
          evidenceInputHash: currentEvidenceHash,
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
      "DISCOVERY_REPORT_GENERATE_ERROR",
      "تعذر توليد تقرير الاكتشاف",
    )
  }
}
