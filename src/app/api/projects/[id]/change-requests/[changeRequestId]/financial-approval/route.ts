import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { z } from "zod"

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("APPROVE"),
    reference: z.string().trim().min(3).max(500),
    notes: z.string().trim().max(4000).optional().nullable(),
  }),
  z.object({
    action: z.literal("REJECT"),
    notes: z.string().trim().min(3).max(4000),
  }),
])

async function decideFinancialApproval(request: Request, context: { params: Promise<{ id: string; changeRequestId: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  if (!hasRole(user.role, ACCESS_ROLES.financeManagement)) {
    throw new ApiError("لا تملك صلاحية اعتماد الأثر المالي", 403, "PROJECT_CHANGE_FINANCE_FORBIDDEN")
  }
  const { id: projectId, changeRequestId } = await context.params
  const parsed = inputSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "بيانات القرار المالي غير صحيحة", 400, "INVALID_PROJECT_CHANGE_FINANCE_INPUT")
  const meta = await getRequestMeta()
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ProjectChangeRequest" WHERE "id" = ${changeRequestId} AND "projectId" = ${projectId} AND "companyId" = ${user.companyId} FOR UPDATE`
    const current = await tx.projectChangeRequest.findFirst({ where: { id: changeRequestId, projectId, companyId: user.companyId } })
    if (!current) throw new ApiError("طلب التغيير غير موجود", 404, "PROJECT_CHANGE_REQUEST_NOT_FOUND")
    if (current.commercialImpact === "NONE" || current.financialApprovalStatus !== "PENDING") {
      throw new ApiError("لا ينتظر هذا الطلب قرارًا ماليًا", 409, "PROJECT_CHANGE_FINANCE_NOT_PENDING")
    }
    if (user.role !== "OWNER" && current.createdById === user.id) {
      throw new ApiError("لا يمكن اعتماد أثر مالي لطلب أنشأته بنفسك", 403, "PROJECT_CHANGE_FINANCE_SELF_APPROVAL_FORBIDDEN")
    }
    const approved = parsed.data.action === "APPROVE"
    const updated = await tx.projectChangeRequest.update({
      where: { id: current.id },
      data: {
        financialApprovalStatus: approved ? "APPROVED" : "REJECTED",
        financialApprovalReference:
          parsed.data.action === "APPROVE" ? parsed.data.reference : null,
        financialApprovalNotes: parsed.data.notes ?? null,
        financialApprovedById: approved ? user.id : null,
        financialApprovedAt: approved ? new Date() : null,
      },
      include: { financialApprovedBy: { select: { id: true, name: true } } },
    })
    await logActivity({
      db: tx,
      companyId: user.companyId,
      userId: user.id,
      action: approved ? ActivityAction.PROJECT_CHANGE_FINANCE_APPROVED : ActivityAction.PROJECT_CHANGE_FINANCE_REJECTED,
      entityType: "ProjectChangeRequest",
      entityId: current.id,
      message: `${approved ? "تم اعتماد" : "تم رفض"} الأثر المالي لطلب التغيير ${current.requestNumber}`,
      metadata: { projectId, requestNumber: current.requestNumber, amount: current.financialAmount?.toString(), currency: current.financialCurrency },
      ...meta,
    })
    return updated
  }, { isolationLevel: "Serializable" })
  return ok({ changeRequest: result })
}

export const PATCH = withApiHandler("PROJECT_CHANGE_FINANCE_DECISION_ERROR", decideFinancialApproval, "تعذر تسجيل القرار المالي")
