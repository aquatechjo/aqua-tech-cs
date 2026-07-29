import {
  ActivityAction,
  SalesOpportunityStage,
} from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  canConvertLeadToOpportunity,
  leadSourceToOpportunitySource,
} from "@/lib/crm-lead"
import { assertLeadOwner } from "@/lib/crm-lead-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"
import { defaultProbability } from "@/lib/sales"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.salesManagement,
      "لا تملك صلاحية تحويل العملاء المحتملين",
    )

    const { id } = await params
    const meta = await getRequestMeta()
    const now = new Date()

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Lead"
        WHERE "id" = ${id}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const lead = await tx.lead.findFirst({
        where: {
          id,
          companyId: user.companyId,
        },
        include: {
          opportunity: {
            select: { id: true },
          },
        },
      })

      if (!lead) {
        throw new ApiError(
          "العميل المحتمل غير موجود",
          404,
          "LEAD_NOT_FOUND",
        )
      }

      if (lead.opportunity) {
        if (lead.status !== "CONVERTED") {
          await tx.lead.update({
            where: { id: lead.id },
            data: {
              status: "CONVERTED",
              convertedAt: lead.convertedAt ?? now,
            },
          })
        }

        return {
          opportunityId: lead.opportunity.id,
          replayed: true,
        }
      }

      if (
        !canConvertLeadToOpportunity({
          status: lead.status,
          hasOpportunity: false,
        })
      ) {
        throw new ApiError(
          "يجب تأهيل العميل المحتمل قبل تحويله إلى فرصة بيع",
          409,
          "LEAD_QUALIFICATION_REQUIRED",
        )
      }

      if (lead.serviceRequestId) {
        const existingFromRequest = await tx.salesOpportunity.findUnique({
          where: { serviceRequestId: lead.serviceRequestId },
          select: { id: true, leadId: true },
        })

        if (existingFromRequest) {
          if (
            existingFromRequest.leadId &&
            existingFromRequest.leadId !== lead.id
          ) {
            throw new ApiError(
              "طلب الخدمة مرتبط بفرصة تخص سجل Lead آخر",
              409,
              "SERVICE_REQUEST_LEAD_MISMATCH",
            )
          }

          if (!existingFromRequest.leadId) {
            await tx.salesOpportunity.update({
              where: { id: existingFromRequest.id },
              data: { leadId: lead.id },
            })
          }

          await tx.lead.update({
            where: { id: lead.id },
            data: {
              status: "CONVERTED",
              convertedAt: lead.convertedAt ?? now,
            },
          })

          return {
            opportunityId: existingFromRequest.id,
            replayed: true,
          }
        }
      }

      const ownerId = lead.ownerId ?? user.id
      await assertLeadOwner(tx, user.companyId, ownerId)
      const stage: SalesOpportunityStage = "QUALIFIED"
      const title = `${lead.serviceType} - ${
        lead.companyName?.trim() || lead.contactName
      }`

      const opportunity = await tx.salesOpportunity.create({
        data: {
          companyId: user.companyId,
          serviceRequestId: lead.serviceRequestId,
          leadId: lead.id,
          clientId: lead.clientId,
          ownerId,
          title,
          contactName: lead.contactName,
          companyName: lead.companyName,
          email: lead.email,
          phone: lead.phone,
          serviceType: lead.serviceType,
          stage,
          priority: lead.priority,
          source: leadSourceToOpportunitySource(lead.source),
          estimatedValue: "0.00",
          currency: user.company.currency,
          probability: defaultProbability(stage),
          nextFollowUpAt: lead.nextActionAt,
          notes: lead.notes,
        },
      })

      await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: "CONVERTED",
          ownerId,
          convertedAt: lead.convertedAt ?? now,
        },
      })

      if (lead.serviceRequestId) {
        await tx.serviceRequest.updateMany({
          where: {
            id: lead.serviceRequestId,
            companyId: user.companyId,
            status: { not: "CONVERTED" },
          },
          data: {
            status: "QUALIFIED",
            assignedToId: ownerId,
          },
        })
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.SALES_OPPORTUNITY_CREATED,
        entityType: "SalesOpportunity",
        entityId: opportunity.id,
        message: `تم تحويل العميل المحتمل إلى فرصة بيع: ${opportunity.title}`,
        metadata: {
          leadId: lead.id,
          serviceRequestId: lead.serviceRequestId,
          stage: opportunity.stage,
          ownerId,
        },
        ...meta,
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.LEAD_STATUS_CHANGED,
        entityType: "Lead",
        entityId: lead.id,
        message: `تم تحويل العميل المحتمل إلى فرصة بيع: ${lead.contactName}`,
        metadata: {
          previousStatus: lead.status,
          status: "CONVERTED",
          opportunityId: opportunity.id,
        },
        ...meta,
      })

      return {
        opportunityId: opportunity.id,
        replayed: false,
      }
    })

    return ok(result, result.replayed ? 200 : 201)
  } catch (error) {
    return handleApiError(
      error,
      "LEAD_CONVERT_ERROR",
      "تعذر تحويل العميل المحتمل إلى فرصة بيع",
    )
  }
}
