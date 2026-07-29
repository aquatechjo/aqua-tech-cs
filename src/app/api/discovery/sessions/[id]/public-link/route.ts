import { z } from "zod"

import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  createDiscoveryPublicAccess,
} from "@/lib/discovery-conversation-server"
import {
  DISCOVERY_PUBLIC_LINK_DAYS,
  publicDiscoveryPath,
} from "@/lib/discovery-conversation"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const publicLinkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ISSUE"),
    validDays: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .default(DISCOVERY_PUBLIC_LINK_DAYS),
  }),
  z.object({
    action: z.literal("REVOKE"),
  }),
])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.discoveryManagement,
      "لا تملك صلاحية إدارة رابط محادثة الاكتشاف",
    )

    const parsed = publicLinkSchema.safeParse(
      await readJsonBody(request),
    )

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ?? "بيانات الرابط غير صحيحة",
        400,
        parsed.error.flatten(),
      )
    }

    const { id } = await params
    const now = new Date()
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
          publicAccessTokenHash: true,
          publicAccessExpiresAt: true,
          conversationSubmittedAt: true,
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

      if (parsed.data.action === "ISSUE") {
        if (
          session.status === "READY_FOR_REVIEW" ||
          session.status === "COMPLETED" ||
          session.status === "ARCHIVED" ||
          session.conversationSubmittedAt
        ) {
          throw new ApiError(
            "لا يمكن إصدار رابط لجلسة مغلقة أو أرسلها العميل بالفعل",
            409,
            "DISCOVERY_PUBLIC_LINK_LOCKED",
          )
        }

        const access = createDiscoveryPublicAccess({
          now,
          validDays: parsed.data.validDays,
        })

        await tx.intakeSession.update({
          where: { id: session.id },
          data: {
            publicAccessTokenHash: access.tokenHash,
            publicAccessExpiresAt: access.expiresAt,
            publicAccessRevokedAt: null,
            updatedById: user.id,
          },
        })

        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.DISCOVERY_PUBLIC_LINK_ISSUED,
          entityType: "IntakeSession",
          entityId: session.id,
          message: `تم إصدار رابط محادثة اكتشاف: ${session.lead.contactName}`,
          metadata: {
            leadId: session.lead.id,
            expiresAt: access.expiresAt.toISOString(),
            rotated: Boolean(session.publicAccessTokenHash),
          },
          ...meta,
        })

        return {
          active: true,
          path: publicDiscoveryPath(access.token),
          expiresAt: access.expiresAt.toISOString(),
        }
      }

      await tx.intakeSession.update({
        where: { id: session.id },
        data: {
          publicAccessTokenHash: null,
          publicAccessRevokedAt: now,
          updatedById: user.id,
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.DISCOVERY_PUBLIC_LINK_REVOKED,
        entityType: "IntakeSession",
        entityId: session.id,
        message: `تم إلغاء رابط محادثة اكتشاف: ${session.lead.contactName}`,
        metadata: {
          leadId: session.lead.id,
          hadActiveLink: Boolean(session.publicAccessTokenHash),
          previousExpiresAt:
            session.publicAccessExpiresAt?.toISOString() ?? null,
        },
        ...meta,
      })

      return {
        active: false,
        path: null,
        expiresAt: null,
      }
    })

    return ok(result)
  } catch (error) {
    return handleApiError(
      error,
      "DISCOVERY_PUBLIC_LINK_POST_ERROR",
      "تعذر إدارة رابط محادثة الاكتشاف",
    )
  }
}
