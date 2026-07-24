import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import {
  assertSalesOwner,
  opportunitySeedFromServiceRequest,
} from "@/lib/sales-server"

const inputSchema = z.object({
  serviceRequestId: z.string().trim().min(1),
})

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.salesManagement)

    const parsed = inputSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError(
        "طلب الخدمة مطلوب",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    const meta = await getRequestMeta()

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "ServiceRequest"
        WHERE "id" = ${parsed.data.serviceRequestId}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const serviceRequest = await tx.serviceRequest.findFirst({
        where: {
          id: parsed.data.serviceRequestId,
          companyId: user.companyId,
        },
      })

      if (!serviceRequest) {
        throw new ApiError(
          "طلب الخدمة غير موجود",
          404,
          "SERVICE_REQUEST_NOT_FOUND",
        )
      }

      const existing = await tx.salesOpportunity.findUnique({
        where: { serviceRequestId: serviceRequest.id },
        select: { id: true },
      })

      if (existing) {
        return { opportunityId: existing.id, replayed: true }
      }

      await assertSalesOwner(tx, user.companyId, serviceRequest.assignedToId)
      const seed = opportunitySeedFromServiceRequest(serviceRequest)

      const opportunity = await tx.salesOpportunity.create({
        data: {
          companyId: user.companyId,
          serviceRequestId: serviceRequest.id,
          clientId: serviceRequest.clientId,
          projectId: serviceRequest.projectId,
          ownerId: seed.ownerId,
          title: seed.title,
          contactName: seed.contactName,
          companyName: seed.companyName,
          email: seed.email,
          phone: seed.phone,
          serviceType: seed.serviceType,
          stage: seed.stage,
          priority: serviceRequest.priority,
          source: serviceRequest.source,
          estimatedValue: "0.00",
          currency: user.company.currency,
          probability: seed.probability,
          lostReason: seed.lostReason,
          lostAt: seed.lostAt,
          wonAt: seed.wonAt,
          notes: seed.notes,
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.SALES_OPPORTUNITY_CREATED,
        entityType: "SalesOpportunity",
        entityId: opportunity.id,
        message: `تم تحويل طلب الخدمة إلى فرصة بيع: ${opportunity.title}`,
        metadata: {
          serviceRequestId: serviceRequest.id,
          stage: opportunity.stage,
        },
        ...meta,
      })

      return { opportunityId: opportunity.id, replayed: false }
    })

    return ok(result, result.replayed ? 200 : 201)
  } catch (error) {
    return handleApiError(
      error,
      "SALES_FROM_SERVICE_REQUEST_ERROR",
      "تعذر إنشاء فرصة من طلب الخدمة",
    )
  }
}
