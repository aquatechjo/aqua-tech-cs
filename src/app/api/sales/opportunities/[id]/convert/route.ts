import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { createProjectWithWorkflow } from "@/lib/project-workflow-server"
import { assertSameOrigin } from "@/lib/request-security"
import { wonOpportunityState } from "@/lib/sales"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.salesManagement)
    const { id } = await params
    const meta = await getRequestMeta()

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "SalesOpportunity"
        WHERE "id" = ${id}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const opportunity = await tx.salesOpportunity.findFirst({
        where: { id, companyId: user.companyId },
        include: {
          serviceRequest: true,
          client: { select: { id: true, status: true } },
          project: { select: { id: true } },
        },
      })

      if (!opportunity) {
        throw new ApiError("فرصة البيع غير موجودة", 404, "OPPORTUNITY_NOT_FOUND")
      }

      if (opportunity.stage === "LOST") {
        throw new ApiError(
          "أعد فتح الفرصة قبل تسجيلها كفوز",
          409,
          "LOST_OPPORTUNITY_CANNOT_CONVERT",
        )
      }

      if (opportunity.stage === "WON" && opportunity.clientId && opportunity.projectId) {
        return {
          opportunityId: opportunity.id,
          clientId: opportunity.clientId,
          projectId: opportunity.projectId,
          replayed: true,
        }
      }

      let clientId = opportunity.clientId ?? opportunity.serviceRequest?.clientId ?? null

      if (clientId) {
        const client = await tx.client.findFirst({
          where: { id: clientId, companyId: user.companyId },
          select: { id: true, status: true },
        })

        if (!client) {
          throw new ApiError("العميل المرتبط غير موجود", 404, "CLIENT_NOT_FOUND")
        }

        if (client.status !== "ACTIVE") {
          await tx.client.update({
            where: { id: client.id },
            data: { status: "ACTIVE" },
          })
        }
      } else {
        const client = await tx.client.create({
          data: {
            companyId: user.companyId,
            name: opportunity.companyName?.trim() || opportunity.contactName,
            email: opportunity.email,
            phone: opportunity.phone,
            type: opportunity.companyName ? "COMPANY" : "INDIVIDUAL",
            status: "ACTIVE",
            source:
              opportunity.source === "MANUAL"
                ? "DIRECT"
                : opportunity.source === "OTHER"
                  ? "OTHER"
                  : opportunity.source,
            notes: opportunity.notes,
          },
        })
        clientId = client.id
      }

      let projectId = opportunity.projectId ?? opportunity.serviceRequest?.projectId ?? null

      if (projectId) {
        const project = await tx.project.findFirst({
          where: { id: projectId, companyId: user.companyId },
          select: { id: true, clientId: true },
        })

        if (!project) {
          throw new ApiError("المشروع المرتبط غير موجود", 404, "PROJECT_NOT_FOUND")
        }

        if (project.clientId && project.clientId !== clientId) {
          throw new ApiError(
            "المشروع المرتبط يتبع عميلًا مختلفًا",
            409,
            "PROJECT_CLIENT_MISMATCH",
          )
        }

        if (!project.clientId) {
          await tx.project.update({
            where: { id: project.id },
            data: { clientId },
          })
        }
      } else {
        const created = await createProjectWithWorkflow(tx, {
          companyId: user.companyId,
          createdById: user.id,
          templateHint: opportunity.serviceType ?? opportunity.title,
          project: {
            clientId,
            name: opportunity.title,
            description: opportunity.notes,
            status: "PLANNING",
            priority: opportunity.priority,
            budget: opportunity.estimatedValue.toString(),
            currency: opportunity.currency,
            startDate: new Date(),
          },
        })
        projectId = created.project.id
      }

      const convertedAt = new Date()
      const updated = await tx.salesOpportunity.update({
        where: { id: opportunity.id },
        data: {
          clientId,
          projectId,
          ...wonOpportunityState(convertedAt),
        },
      })

      if (opportunity.serviceRequestId) {
        await tx.serviceRequest.updateMany({
          where: {
            id: opportunity.serviceRequestId,
            companyId: user.companyId,
          },
          data: {
            clientId,
            projectId,
            status: "CONVERTED",
            convertedAt,
          },
        })
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.SALES_OPPORTUNITY_WON,
        entityType: "SalesOpportunity",
        entityId: updated.id,
        message: `تم تسجيل فوز فرصة البيع: ${updated.title}`,
        metadata: {
          clientId,
          projectId,
          estimatedValue: updated.estimatedValue.toString(),
          currency: updated.currency,
        },
        ...meta,
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.SALES_OPPORTUNITY_CONVERTED,
        entityType: "SalesOpportunity",
        entityId: updated.id,
        message: `تم تحويل فرصة البيع إلى عميل ومشروع: ${updated.title}`,
        metadata: { clientId, projectId },
        ...meta,
      })

      return {
        opportunityId: updated.id,
        clientId,
        projectId,
        replayed: false,
      }
    })

    return ok(result)
  } catch (error) {
    return handleApiError(
      error,
      "SALES_OPPORTUNITY_CONVERT_ERROR",
      "تعذر تحويل فرصة البيع",
    )
  }
}
