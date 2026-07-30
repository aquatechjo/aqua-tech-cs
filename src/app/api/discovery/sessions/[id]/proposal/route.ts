import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { pricingVersionContentSchema } from "@/lib/pricing"
import {
  normalizeProposalContent,
  proposalDraftInputSchema,
} from "@/lib/proposal"
import {
  assertProposalSourceReady,
  proposalClientContentHash,
  proposalContentHash,
} from "@/lib/proposal-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { nextProposalNumber } from "@/lib/sales-server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.proposalManagement,
      "لا تملك صلاحية إعداد العرض",
    )

    const parsed = proposalDraftInputSchema.safeParse(
      await readJsonBody(request, 128 * 1024),
    )

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ?? "بيانات العرض غير مكتملة",
        400,
        parsed.error.flatten(),
      )
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
              currentVersion: true,
            },
          },
          pricingWorkspace: {
            select: {
              id: true,
              status: true,
              currentVersion: true,
            },
          },
          proposalWorkspace: {
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

      assertProposalSourceReady({
        pricingStatus: session.pricingWorkspace?.status ?? null,
        pricingVersion: session.pricingWorkspace?.currentVersion ?? 0,
      })

      if (!session.pricingWorkspace || !session.report) {
        throw new ApiError(
          "مصادر العرض المعتمدة غير مكتملة",
          409,
          "PROPOSAL_SOURCE_MISSING",
        )
      }

      const pricingVersion = await tx.pricingVersion.findUnique({
        where: {
          workspaceId_version: {
            workspaceId: session.pricingWorkspace.id,
            version: session.pricingWorkspace.currentVersion,
          },
        },
      })

      if (!pricingVersion) {
        throw new ApiError(
          "إصدار التسعير المعتمد غير موجود",
          404,
          "PRICING_VERSION_NOT_FOUND",
        )
      }

      const pricingContent = pricingVersionContentSchema.safeParse(
        pricingVersion.content,
      )

      if (!pricingContent.success) {
        throw new ApiError(
          "إصدار التسعير المعتمد لا يطابق عقد البيانات",
          409,
          "PRICING_VERSION_INVALID",
        )
      }

      const content = normalizeProposalContent({
        draft: parsed.data,
        pricing: pricingContent.data,
      })
      const contentHash = proposalContentHash(content)
      const clientContentHash = proposalClientContentHash(content)

      let workspaceId = session.proposalWorkspace?.id

      if (!workspaceId) {
        const proposalNumber = await nextProposalNumber(
          tx,
          user.companyId,
          user.company.timezone,
        )
        const created = await tx.proposalWorkspace.create({
          data: {
            companyId: user.companyId,
            intakeSessionId: session.id,
            pricingWorkspaceId: session.pricingWorkspace.id,
            opportunityId: session.opportunity?.id ?? null,
            createdById: user.id,
            proposalNumber,
          },
        })
        workspaceId = created.id
      }

      await tx.$queryRaw`
        SELECT "id"
        FROM "ProposalWorkspace"
        WHERE "id" = ${workspaceId}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const workspace = await tx.proposalWorkspace.findFirst({
        where: {
          id: workspaceId,
          companyId: user.companyId,
        },
        include: {
          versions: {
            where: {
              version: {
                gt: 0,
              },
            },
            orderBy: {
              version: "desc",
            },
            take: 1,
          },
        },
      })

      if (!workspace) {
        throw new ApiError(
          "مساحة العرض غير موجودة",
          404,
          "PROPOSAL_WORKSPACE_NOT_FOUND",
        )
      }

      if (
        workspace.status !== "DRAFT" &&
        workspace.status !== "CHANGES_REQUESTED" &&
        workspace.status !== "CLIENT_CHANGES_REQUESTED"
      ) {
        throw new ApiError(
          "العرض مقفل في حالته الحالية ولا يقبل إصدارًا جديدًا",
          409,
          "PROPOSAL_WORKSPACE_LOCKED",
        )
      }

      if (workspace.versions[0]?.contentHash === contentHash) {
        throw new ApiError(
          "لا توجد تعديلات جديدة لحفظ إصدار آخر",
          409,
          "PROPOSAL_NO_CHANGES",
        )
      }

      const version = workspace.currentVersion + 1

      await tx.proposalVersion.create({
        data: {
          companyId: user.companyId,
          workspaceId: workspace.id,
          createdById: user.id,
          version,
          content,
          contentHash,
          clientContentHash,
          pricingVersion: pricingVersion.version,
          pricingContentHash: pricingVersion.contentHash,
          discoveryReportVersion:
            pricingVersion.discoveryReportVersion,
          discoveryContentHash: pricingVersion.discoveryContentHash,
        },
      })

      await tx.proposalWorkspace.update({
        where: {
          id: workspace.id,
        },
        data: {
          opportunityId: session.opportunity?.id ?? null,
          status: "DRAFT",
          currentVersion: version,
          reviewNotes: null,
          submittedAt: null,
          reviewedById: null,
          approvedAt: null,
          sentVersion: null,
          sentClientContentHash: null,
          sentAt: null,
          clientRespondedAt: null,
          clientResponseName: null,
          clientResponseEmail: null,
          clientResponseTitle: null,
          clientResponseNotes: null,
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PROPOSAL_VERSION_CREATED,
        entityType: "ProposalWorkspace",
        entityId: workspace.id,
        message: `تم حفظ إصدار عرض مركزي: ${version}`,
        metadata: {
          intakeSessionId: session.id,
          leadId: session.lead.id,
          opportunityId: session.opportunity?.id ?? null,
          pricingWorkspaceId: session.pricingWorkspace.id,
          pricingVersion: pricingVersion.version,
          version,
          proposalNumber: workspace.proposalNumber,
          clientContentHash,
        },
        ...meta,
      })

      return {
        workspaceId: workspace.id,
        proposalNumber: workspace.proposalNumber,
        status: "DRAFT" as const,
        version,
      }
    })

    return ok(result)
  } catch (error) {
    return handleApiError(
      error,
      "PROPOSAL_SAVE_ERROR",
      "تعذر حفظ إصدار العرض",
    )
  }
}
