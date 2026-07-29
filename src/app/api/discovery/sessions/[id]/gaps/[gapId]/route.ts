import { z } from "zod"

import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const updateGapSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("WAIVE"),
    resolution: z.string().trim().min(10).max(2000),
  }),
  z.object({
    action: z.literal("REOPEN"),
  }),
])

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; gapId: string }>
  },
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.discoveryManagement,
      "لا تملك صلاحية معالجة فجوات المتطلبات",
    )

    const parsed = updateGapSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ?? "بيانات معالجة الفجوة غير صحيحة",
        400,
        parsed.error.flatten(),
      )
    }

    const { id, gapId } = await params
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
        include: {
          lead: {
            select: {
              id: true,
              contactName: true,
            },
          },
        },
      })

      if (!session) {
        throw new ApiError(
          "جلسة جمع المتطلبات غير موجودة",
          404,
          "DISCOVERY_SESSION_NOT_FOUND",
        )
      }

      if (session.status === "COMPLETED" || session.status === "ARCHIVED") {
        throw new ApiError(
          "لا يمكن تعديل فجوات جلسة مكتملة أو مؤرشفة",
          409,
          "DISCOVERY_SESSION_LOCKED",
        )
      }

      const gap = await tx.requirementGap.findFirst({
        where: {
          id: gapId,
          intakeSessionId: session.id,
          companyId: user.companyId,
        },
      })

      if (!gap) {
        throw new ApiError(
          "فجوة المتطلبات غير موجودة",
          404,
          "DISCOVERY_GAP_NOT_FOUND",
        )
      }

      const waived = parsed.data.action === "WAIVE"
      const waiverResolution =
        parsed.data.action === "WAIVE"
          ? parsed.data.resolution
          : null
      const updatedGap = await tx.requirementGap.update({
        where: { id: gap.id },
        data: waived
          ? {
              status: "WAIVED",
              resolution: waiverResolution,
              resolvedById: user.id,
              resolvedAt: now,
            }
          : {
              status: "OPEN",
              resolution: null,
              resolvedById: null,
              resolvedAt: null,
            },
      })

      if (!waived && session.status === "READY_FOR_REVIEW") {
        await tx.intakeSession.update({
          where: { id: session.id },
          data: {
            status: "NEEDS_INFO",
            readyForReviewAt: null,
            updatedById: user.id,
          },
        })
      } else {
        await tx.intakeSession.update({
          where: { id: session.id },
          data: {
            updatedById: user.id,
          },
        })
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: waived
          ? ActivityAction.DISCOVERY_GAP_WAIVED
          : ActivityAction.DISCOVERY_GAP_REOPENED,
        entityType: "RequirementGap",
        entityId: gap.id,
        message: waived
          ? `تم تجاوز فجوة متطلبات بسبب موثق: ${session.lead.contactName}`
          : `تمت إعادة فتح فجوة متطلبات: ${session.lead.contactName}`,
        metadata: {
          intakeSessionId: session.id,
          leadId: session.lead.id,
          questionKey: gap.questionKey,
          severity: gap.severity,
          previousStatus: gap.status,
          status: updatedGap.status,
          resolution: updatedGap.resolution,
        },
        ...meta,
      })

      return {
        gapId: updatedGap.id,
        status: updatedGap.status,
      }
    })

    return ok(result)
  } catch (error) {
    return handleApiError(
      error,
      "DISCOVERY_GAP_PATCH_ERROR",
      "تعذر معالجة فجوة المتطلبات",
    )
  }
}
