import { z } from "zod"

import type { Prisma } from "@/generated/prisma/client"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { sendProposalDeliveryEmail } from "@/lib/email"
import {
  configuredAppOrigin,
  createProposalPublicAccess,
} from "@/lib/proposal-delivery-server"
import {
  proposalRecipientSchema,
  proposalValidUntil,
  proposalWhatsappUrl,
  publicProposalPath,
} from "@/lib/proposal-delivery"
import {
  proposalReviewIssues,
  proposalVersionContentSchema,
} from "@/lib/proposal"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { syncServiceRequestStage } from "@/lib/sales-server"

const prepareDeliverySchema = proposalRecipientSchema.extend({
  action: z.literal("PREPARE"),
  channel: z.enum(["SECURE_LINK", "WHATSAPP"]),
})

const sendEmailSchema = proposalRecipientSchema.extend({
  action: z.literal("SEND_EMAIL"),
  channel: z.literal("EMAIL"),
  recipientEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("البريد الإلكتروني غير صحيح")
    .max(320),
})

const deliveryActionSchema = z.discriminatedUnion("action", [
  prepareDeliverySchema,
  sendEmailSchema,
  z.object({
    action: z.literal("CONFIRM"),
    deliveryId: z.string().trim().min(1).max(120),
  }),
  z.object({
    action: z.literal("REVOKE"),
    deliveryId: z.string().trim().min(1).max(120).optional(),
  }),
])

type PreparedDelivery = {
  id: string
  channel: "EMAIL" | "SECURE_LINK" | "WHATSAPP"
  version: number
  token: string
  path: string
  publicUrl: string
  expiresAt: Date
  proposalNumber: string
  proposalTitle: string
  validityDays: number
  recipientName: string
  recipientEmail: string | null
  recipientPhone: string | null
}

async function finalizeDelivery({
  deliveryId,
  companyId,
  userId,
  meta,
  providerMessageId,
}: {
  deliveryId: string
  companyId: string
  userId: string
  meta: Awaited<ReturnType<typeof getRequestMeta>>
  providerMessageId?: string | null
}) {
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "ProposalDelivery"
      WHERE "id" = ${deliveryId}
        AND "companyId" = ${companyId}
      FOR UPDATE
    `

    const delivery = await tx.proposalDelivery.findFirst({
      where: {
        id: deliveryId,
        companyId,
      },
      include: {
        workspace: {
          include: {
            intakeSession: {
              select: {
                lead: {
                  select: {
                    id: true,
                  },
                },
              },
            },
            opportunity: {
              select: {
                id: true,
                stage: true,
                probability: true,
                serviceRequestId: true,
                ownerId: true,
              },
            },
          },
        },
      },
    })

    if (!delivery) {
      throw new ApiError(
        "محاولة تسليم العرض غير موجودة",
        404,
        "PROPOSAL_DELIVERY_NOT_FOUND",
      )
    }

    if (delivery.status === "SENT") {
      return {
        deliveryId: delivery.id,
        status: delivery.status,
        sentAt: delivery.sentAt?.toISOString() ?? null,
        replayed: true,
      }
    }

    if (
      delivery.status !== "PREPARED" ||
      delivery.revokedAt ||
      delivery.expiresAt.getTime() < now.getTime()
    ) {
      throw new ApiError(
        "محاولة التسليم ملغاة أو منتهية",
        409,
        "PROPOSAL_DELIVERY_NOT_CONFIRMABLE",
      )
    }

    const workspace = delivery.workspace
    if (
      (workspace.status !== "APPROVED" &&
        workspace.status !== "SENT") ||
      workspace.currentVersion !== delivery.version
    ) {
      throw new ApiError(
        "العرض تغير أو لم يعد معتمدًا للإرسال",
        409,
        "PROPOSAL_DELIVERY_SOURCE_CHANGED",
      )
    }

    const version = await tx.proposalVersion.findUnique({
      where: {
        workspaceId_version: {
          workspaceId: workspace.id,
          version: delivery.version,
        },
      },
    })
    const parsedContent = proposalVersionContentSchema.safeParse(
      version?.content,
    )

    if (
      !version ||
      version.clientContentHash !== delivery.clientContentHash ||
      !parsedContent.success ||
      proposalReviewIssues(parsedContent.data).length > 0
    ) {
      throw new ApiError(
        "نسخة العرض المعدة للتسليم لم تعد صالحة",
        409,
        "PROPOSAL_DELIVERY_VERSION_INVALID",
      )
    }

    const expiresAt = proposalValidUntil({
      startedAt: now,
      validityDays: parsedContent.data.validityDays,
    })

    await tx.proposalDelivery.updateMany({
      where: {
        companyId,
        workspaceId: workspace.id,
        id: { not: delivery.id },
        status: { in: ["PREPARED", "SENT"] },
        revokedAt: null,
      },
      data: {
        status: "REVOKED",
        revokedAt: now,
      },
    })

    await tx.proposalDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        sentAt: now,
        expiresAt,
        providerMessageId: providerMessageId ?? null,
        failureCode: null,
        failureMessage: null,
      },
    })

    await tx.proposalWorkspace.update({
      where: { id: workspace.id },
      data: {
        status: "SENT",
        sentVersion: delivery.version,
        sentClientContentHash: delivery.clientContentHash,
        sentAt: now,
        clientRespondedAt: null,
        clientResponseName: null,
        clientResponseEmail: null,
        clientResponseTitle: null,
        clientResponseNotes: null,
      },
    })

    const opportunity = workspace.opportunity
    if (opportunity) {
      const existingSnapshot = await tx.salesProposal.findUnique({
        where: {
          opportunityId_version: {
            opportunityId: opportunity.id,
            version: delivery.version,
          },
        },
      })
      const proposalNumber = `${workspace.proposalNumber}-V${delivery.version}`
      const snapshotData = {
        status: "SENT" as const,
        title: parsedContent.data.title,
        amount: parsedContent.data.commercial.totals.grandTotal,
        currency: parsedContent.data.commercial.currency,
        validUntil: expiresAt,
        url: null,
        notes: "Central Proposal Engine",
        sentAt: now,
        acceptedAt: null,
        rejectedAt: null,
      }

      if (existingSnapshot) {
        await tx.salesProposal.update({
          where: { id: existingSnapshot.id },
          data: snapshotData,
        })
      } else {
        await tx.salesProposal.create({
          data: {
            companyId,
            opportunityId: opportunity.id,
            createdById: userId,
            proposalNumber,
            version: delivery.version,
            ...snapshotData,
          },
        })
      }

      if (
        opportunity.stage !== "WON" &&
        opportunity.stage !== "LOST"
      ) {
        await tx.salesOpportunity.update({
          where: { id: opportunity.id },
          data: {
            stage:
              opportunity.stage === "NEGOTIATION"
                ? "NEGOTIATION"
                : "PROPOSAL",
            probability: Math.max(opportunity.probability, 60),
            estimatedValue:
              parsedContent.data.commercial.totals.grandTotal,
            lastContactAt: now,
            nextFollowUpAt: new Date(
              now.getTime() + 2 * 24 * 60 * 60 * 1000,
            ),
          },
        })
        await syncServiceRequestStage(
          tx,
          companyId,
          opportunity.serviceRequestId,
          "PROPOSAL",
        )
      }
    }

    await tx.lead.update({
      where: { id: workspace.intakeSession.lead.id },
      data: {
        nextAction: "متابعة العرض المرسل مع العميل",
        nextActionAt: new Date(
          now.getTime() + 2 * 24 * 60 * 60 * 1000,
        ),
      },
    })

    await logActivity({
      db: tx,
      companyId,
      userId,
      action: ActivityAction.PROPOSAL_SENT,
      entityType: "ProposalWorkspace",
      entityId: workspace.id,
      message: `تم تسليم العرض ${workspace.proposalNumber} للعميل`,
      metadata: {
        deliveryId: delivery.id,
        channel: delivery.channel,
        version: delivery.version,
        clientContentHash: delivery.clientContentHash,
        expiresAt: expiresAt.toISOString(),
        recipientEmail: delivery.recipientEmail,
        recipientPhone: delivery.recipientPhone,
      },
      ...meta,
    })

    const notificationUserId =
      opportunity?.ownerId ?? workspace.createdById
    if (notificationUserId) {
      await tx.notification.create({
        data: {
          companyId,
          userId: notificationUserId,
          title: "تم إرسال عرض للعميل",
          message: `${workspace.proposalNumber} · الإصدار ${delivery.version}`,
          type: "SUCCESS",
          entityType: "ProposalWorkspace",
          entityId: workspace.id,
        },
      })
    }

    return {
      deliveryId: delivery.id,
      status: "SENT" as const,
      sentAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      replayed: false,
    }
  })
}

async function prepareDelivery({
  tx,
  sessionId,
  companyId,
  userId,
  channel,
  recipientName,
  recipientEmail,
  recipientPhone,
  requestUrl,
  meta,
}: {
  tx: Prisma.TransactionClient
  sessionId: string
  companyId: string
  userId: string
  channel: "EMAIL" | "SECURE_LINK" | "WHATSAPP"
  recipientName: string
  recipientEmail: string | null
  recipientPhone: string | null
  requestUrl: string
  meta: Awaited<ReturnType<typeof getRequestMeta>>
}): Promise<PreparedDelivery> {
  await tx.$queryRaw`
    SELECT "id"
    FROM "IntakeSession"
    WHERE "id" = ${sessionId}
      AND "companyId" = ${companyId}
    FOR UPDATE
  `

  const session = await tx.intakeSession.findFirst({
    where: {
      id: sessionId,
      companyId,
    },
    select: {
      proposalWorkspace: {
        select: {
          id: true,
          proposalNumber: true,
          status: true,
          currentVersion: true,
        },
      },
    },
  })

  if (!session?.proposalWorkspace) {
    throw new ApiError(
      "مساحة العرض غير موجودة",
      404,
      "PROPOSAL_WORKSPACE_NOT_FOUND",
    )
  }

  const workspace = session.proposalWorkspace
  if (
    workspace.status !== "APPROVED" &&
    workspace.status !== "SENT"
  ) {
    throw new ApiError(
      "لا يمكن تسليم العرض قبل اعتماده داخليًا",
      409,
      "PROPOSAL_NOT_APPROVED_FOR_DELIVERY",
    )
  }

  const version = await tx.proposalVersion.findUnique({
    where: {
      workspaceId_version: {
        workspaceId: workspace.id,
        version: workspace.currentVersion,
      },
    },
  })
  const parsedContent = proposalVersionContentSchema.safeParse(
    version?.content,
  )

  if (
    !version ||
    !parsedContent.success ||
    proposalReviewIssues(parsedContent.data).length > 0
  ) {
    throw new ApiError(
      "إصدار العرض المعتمد غير صالح للتسليم",
      409,
      "PROPOSAL_DELIVERY_VERSION_INVALID",
    )
  }

  if (channel === "WHATSAPP" && !recipientPhone) {
    throw new ApiError(
      "رقم واتساب مطلوب",
      400,
      "PROPOSAL_WHATSAPP_PHONE_REQUIRED",
    )
  }

  const access = createProposalPublicAccess({
    validityDays: parsedContent.data.validityDays,
  })
  const path = publicProposalPath(access.token)
  const publicUrl = `${configuredAppOrigin(requestUrl)}${path}`
  const delivery = await tx.proposalDelivery.create({
    data: {
      companyId,
      workspaceId: workspace.id,
      createdById: userId,
      channel,
      status: "PREPARED",
      version: version.version,
      clientContentHash: version.clientContentHash,
      recipientName,
      recipientEmail,
      recipientPhone,
      tokenHash: access.tokenHash,
      expiresAt: access.expiresAt,
    },
  })

  await logActivity({
    db: tx,
    companyId,
    userId,
    action: ActivityAction.PROPOSAL_DELIVERY_PREPARED,
    entityType: "ProposalDelivery",
    entityId: delivery.id,
    message: `تم إعداد تسليم العرض ${workspace.proposalNumber}`,
    metadata: {
      proposalWorkspaceId: workspace.id,
      channel,
      version: version.version,
      clientContentHash: version.clientContentHash,
      recipientEmail,
      recipientPhone,
      expiresAt: access.expiresAt.toISOString(),
    },
    ...meta,
  })

  return {
    id: delivery.id,
    channel,
    version: version.version,
    token: access.token,
    path,
    publicUrl,
    expiresAt: access.expiresAt,
    proposalNumber: workspace.proposalNumber,
    proposalTitle: parsedContent.data.title,
    validityDays: parsedContent.data.validityDays,
    recipientName,
    recipientEmail,
    recipientPhone,
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.proposalDelivery,
      "لا تملك صلاحية إرسال العرض",
    )

    const parsed = deliveryActionSchema.safeParse(
      await readJsonBody(request, 16 * 1024),
    )
    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ??
          "بيانات تسليم العرض غير صحيحة",
        400,
        parsed.error.flatten(),
      )
    }

    const { id } = await params
    const meta = await getRequestMeta()

    if (parsed.data.action === "CONFIRM") {
      const result = await finalizeDelivery({
        deliveryId: parsed.data.deliveryId,
        companyId: user.companyId,
        userId: user.id,
        meta,
      })
      return ok(result)
    }

    if (parsed.data.action === "REVOKE") {
      const revokeData = parsed.data
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
          where: { id, companyId: user.companyId },
          select: {
            proposalWorkspace: {
              select: {
                id: true,
                proposalNumber: true,
                status: true,
                sentVersion: true,
              },
            },
          },
        })

        if (!session?.proposalWorkspace) {
          throw new ApiError(
            "مساحة العرض غير موجودة",
            404,
            "PROPOSAL_WORKSPACE_NOT_FOUND",
          )
        }

        if (
          session.proposalWorkspace.status === "ACCEPTED" ||
          session.proposalWorkspace.status === "REJECTED" ||
          session.proposalWorkspace.status ===
            "CLIENT_CHANGES_REQUESTED"
        ) {
          throw new ApiError(
            "لا يمكن إلغاء رابط بعد تسجيل رد العميل",
            409,
            "PROPOSAL_RESPONSE_ALREADY_RECORDED",
          )
        }

        const sentDelivery = await tx.proposalDelivery.findFirst({
          where: {
            companyId: user.companyId,
            workspaceId: session.proposalWorkspace.id,
            ...(revokeData.deliveryId
              ? { id: revokeData.deliveryId }
              : {}),
            status: "SENT",
            revokedAt: null,
          },
          select: { id: true },
        })

        const revoked = await tx.proposalDelivery.updateMany({
          where: {
            companyId: user.companyId,
            workspaceId: session.proposalWorkspace.id,
            ...(revokeData.deliveryId
              ? { id: revokeData.deliveryId }
              : {}),
            status: { in: ["PREPARED", "SENT"] },
            revokedAt: null,
          },
          data: {
            status: "REVOKED",
            revokedAt: now,
          },
        })

        if (
          session.proposalWorkspace.status === "SENT" &&
          sentDelivery
        ) {
          await tx.proposalWorkspace.update({
            where: { id: session.proposalWorkspace.id },
            data: {
              status: "APPROVED",
              sentVersion: null,
              sentClientContentHash: null,
              sentAt: null,
            },
          })

          if (session.proposalWorkspace.sentVersion) {
            await tx.salesProposal.updateMany({
              where: {
                companyId: user.companyId,
                opportunity: {
                  proposalWorkspace: {
                    id: session.proposalWorkspace.id,
                  },
                },
                version: session.proposalWorkspace.sentVersion,
                status: "SENT",
              },
              data: {
                status: "CANCELLED",
              },
            })
          }
        }

        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.PROPOSAL_LINK_REVOKED,
          entityType: "ProposalWorkspace",
          entityId: session.proposalWorkspace.id,
          message: `تم إلغاء رابط العرض ${session.proposalWorkspace.proposalNumber}`,
          metadata: {
            deliveryId: revokeData.deliveryId ?? null,
            revokedCount: revoked.count,
          },
          ...meta,
        })

        return {
          revokedCount: revoked.count,
          status:
            sentDelivery ? ("APPROVED" as const) : undefined,
        }
      })

      return ok(result)
    }

    if (
      parsed.data.action !== "PREPARE" &&
      parsed.data.action !== "SEND_EMAIL"
    ) {
      throw new ApiError(
        "إجراء تسليم العرض غير صحيح",
        400,
        "PROPOSAL_DELIVERY_ACTION_INVALID",
      )
    }

    const deliveryData = parsed.data
    const prepared = await prisma.$transaction((tx) =>
      prepareDelivery({
        tx,
        sessionId: id,
        companyId: user.companyId,
        userId: user.id,
        channel: deliveryData.channel,
        recipientName: deliveryData.recipientName,
        recipientEmail: deliveryData.recipientEmail ?? null,
        recipientPhone: deliveryData.recipientPhone ?? null,
        requestUrl: request.url,
        meta,
      }),
    )

    if (deliveryData.action === "PREPARE") {
      let whatsappUrl: string | null = null
      if (
        prepared.channel === "WHATSAPP" &&
        prepared.recipientPhone
      ) {
        try {
          whatsappUrl = proposalWhatsappUrl({
            phone: prepared.recipientPhone,
            proposalUrl: prepared.publicUrl,
            proposalNumber: prepared.proposalNumber,
            recipientName: prepared.recipientName,
          })
        } catch {
          await prisma.$transaction(async (tx) => {
            await tx.proposalDelivery.update({
              where: { id: prepared.id },
              data: {
                status: "FAILED",
                revokedAt: new Date(),
                failureCode: "INVALID_WHATSAPP_NUMBER",
                failureMessage: "رقم واتساب غير صالح",
              },
            })
            await logActivity({
              db: tx,
              companyId: user.companyId,
              userId: user.id,
              action: ActivityAction.PROPOSAL_DELIVERY_FAILED,
              entityType: "ProposalDelivery",
              entityId: prepared.id,
              message: `فشل إعداد واتساب للعرض ${prepared.proposalNumber}`,
              metadata: {
                version: prepared.version,
                failureCode: "INVALID_WHATSAPP_NUMBER",
              },
              ...meta,
            })
          })
          throw new ApiError(
            "رقم واتساب غير صالح",
            400,
            "INVALID_WHATSAPP_NUMBER",
          )
        }
      }

      return ok({
        deliveryId: prepared.id,
        channel: prepared.channel,
        status: "PREPARED",
        publicUrl: prepared.publicUrl,
        whatsappUrl,
        expiresAt: prepared.expiresAt.toISOString(),
      })
    }

    const validUntilLabel = new Intl.DateTimeFormat(
      "ar-JO-u-nu-latn",
      {
        timeZone: user.company.timezone,
        year: "numeric",
        month: "long",
        day: "2-digit",
      },
    ).format(prepared.expiresAt)
    let providerMessageId: string | null

    try {
      providerMessageId = await sendProposalDeliveryEmail({
        to: prepared.recipientEmail!,
        recipientName: prepared.recipientName,
        proposalNumber: prepared.proposalNumber,
        proposalTitle: prepared.proposalTitle,
        proposalUrl: prepared.publicUrl,
        validUntilLabel,
      })
    } catch (emailError) {
      const failureMessage =
        emailError instanceof Error
          ? emailError.message.slice(0, 500)
          : "UNKNOWN_EMAIL_ERROR"

      await prisma.$transaction(async (tx) => {
        await tx.proposalDelivery.updateMany({
          where: {
            id: prepared.id,
            companyId: user.companyId,
            status: "PREPARED",
          },
          data: {
            status: "FAILED",
            revokedAt: new Date(),
            failureCode: "EMAIL_DELIVERY_FAILED",
            failureMessage,
          },
        })
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.PROPOSAL_DELIVERY_FAILED,
          entityType: "ProposalDelivery",
          entityId: prepared.id,
          message: `فشل إرسال العرض ${prepared.proposalNumber} بالبريد`,
          metadata: {
            version: prepared.version,
            recipientEmail: prepared.recipientEmail,
            failureCode: "EMAIL_DELIVERY_FAILED",
          },
          ...meta,
        })
      })

      throw new ApiError(
        "تعذر إرسال البريد. لم تُسجل النسخة كمرسلة ويمكن المحاولة مرة أخرى.",
        502,
        "PROPOSAL_EMAIL_DELIVERY_FAILED",
      )
    }

    const finalized = await finalizeDelivery({
      deliveryId: prepared.id,
      companyId: user.companyId,
      userId: user.id,
      meta,
      providerMessageId,
    })

    return ok(finalized)
  } catch (error) {
    return handleApiError(
      error,
      "PROPOSAL_DELIVERY_ERROR",
      "تعذر تنفيذ تسليم العرض",
    )
  }
}
