import { ActivityAction } from "@/generated/prisma/enums"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { nextDocumentNumber } from "@/lib/finance-server"
import { prisma } from "@/lib/prisma"
import {
  projectChangeDraftSchema,
} from "@/lib/project-change-request"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import {
  normalizeProjectChangeItems,
  nullableProjectChangeText,
} from "@/lib/project-change-request-server"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

async function createProjectChangeRequest(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: projectId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const body = await readJsonBody(request)
  const parsed = projectChangeDraftSchema.safeParse(body)

  if (!parsed.success) {
    throw new ApiError(
      parsed.error.issues[0]?.message ?? "بيانات طلب التغيير غير صحيحة",
      400,
      "INVALID_PROJECT_CHANGE_REQUEST_INPUT",
      { details: parsed.error.flatten() },
    )
  }

  const meta = await getRequestMeta()
  const saved = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Project"
        WHERE "id" = ${projectId}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const currentProject = await tx.project.findFirst({
        where: {
          id: projectId,
          companyId: user.companyId,
        },
        select: {
          id: true,
          status: true,
          company: { select: { timezone: true } },
        },
      })
      if (!currentProject) {
        throw new ApiError("المشروع غير موجود", 404, "PROJECT_NOT_FOUND")
      }
      if (["COMPLETED", "CANCELLED", "ARCHIVED"].includes(currentProject.status)) {
        throw new ApiError(
          "لا يمكن إنشاء طلب تغيير لمشروع مغلق",
          409,
          "PROJECT_CHANGE_PROJECT_CLOSED",
        )
      }

      const items = await normalizeProjectChangeItems(tx, {
        companyId: user.companyId,
        projectId,
        items: parsed.data.items,
      })
      const requestNumber = await nextDocumentNumber(
        tx,
        user.companyId,
        "CR",
        new Date(),
        currentProject.company.timezone,
      )

      const changeRequest = await tx.projectChangeRequest.create({
        data: {
          companyId: user.companyId,
          projectId,
          createdById: user.id,
          requestNumber,
          title: parsed.data.title,
          businessReason: parsed.data.businessReason,
          scheduleImpactDays: parsed.data.scheduleImpactDays,
          commercialImpact: parsed.data.commercialImpact,
          commercialReference:
            parsed.data.commercialImpact === "APPROVED"
              ? nullableProjectChangeText(
                  parsed.data.commercialReference,
                )
              : null,
          financialAmount:
            parsed.data.commercialImpact === "NONE"
              ? null
              : parsed.data.financialAmount,
          financialCurrency:
            parsed.data.commercialImpact === "NONE"
              ? null
              : parsed.data.financialCurrency,
          financialApprovalStatus:
            parsed.data.commercialImpact === "NONE"
              ? "NOT_REQUIRED"
              : "PENDING",
          clientApprovalRequired: parsed.data.clientApprovalRequired,
          clientApprovalReference: parsed.data.clientApprovalRequired
            ? nullableProjectChangeText(
                parsed.data.clientApprovalReference,
              )
            : null,
          items: { create: items },
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          items: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              phase: { select: { id: true, name: true } },
              targetDeliverable: { select: { id: true, title: true } },
              resultDeliverable: { select: { id: true, title: true } },
            },
          },
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PROJECT_CHANGE_REQUEST_CREATED,
        entityType: "ProjectChangeRequest",
        entityId: changeRequest.id,
        message: `تم إنشاء طلب تغيير ${requestNumber} لمشروع ${project.name}`,
        metadata: {
          projectId,
          requestNumber,
          itemCount: items.length,
          scheduleImpactDays: parsed.data.scheduleImpactDays,
          commercialImpact: parsed.data.commercialImpact,
        },
        ...meta,
      })

      return changeRequest
    },
    { isolationLevel: "Serializable" },
  )

  return ok({ changeRequest: saved }, 201)
}

export const POST = withApiHandler(
  "PROJECT_CHANGE_REQUEST_POST_ERROR",
  createProjectChangeRequest,
  "تعذر إنشاء طلب تغيير المشروع",
)
