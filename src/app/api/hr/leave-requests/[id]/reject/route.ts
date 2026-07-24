import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { ActivityAction } from "@/generated/prisma/enums"
import { assertCanApproveLeave } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { canTransitionLeave } from "@/lib/hr"
import { leaveRequestInclude, serializeLeaveRequest } from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const rejectSchema = z.object({ reason: z.string().trim().min(3).max(1000) })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const { id } = await params
    const parsed = rejectSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) throw new ApiError("سبب الرفض مطلوب", 400, "REJECTION_REASON_REQUIRED")
    const existing = await prisma.leaveRequest.findFirst({
      where: { id, companyId: user.companyId },
      include: { user: { select: { id: true, name: true } }, leaveType: { select: { name: true } } },
    })
    if (!existing) throw new ApiError("طلب الإجازة غير موجود", 404, "LEAVE_REQUEST_NOT_FOUND")
    assertCanApproveLeave(user, existing.userId)
    if (!canTransitionLeave(existing.status, "REJECTED")) {
      throw new ApiError("لا يمكن رفض الطلب بحالته الحالية", 409, "INVALID_LEAVE_TRANSITION")
    }
    const meta = await getRequestMeta()
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.leaveRequest.updateMany({
        where: { id: existing.id, companyId: user.companyId, status: "PENDING" },
        data: {
          status: "REJECTED",
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNote: parsed.data.reason,
        },
      })
      if (claimed.count !== 1) {
        throw new ApiError(
          "تمت معالجة طلب الإجازة من مستخدم آخر",
          409,
          "LEAVE_REQUEST_ALREADY_PROCESSED",
        )
      }
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.LEAVE_REQUEST_REJECTED,
        entityType: "LeaveRequest",
        entityId: existing.id,
        message: `تم رفض طلب إجازة ${existing.user.name}`,
        metadata: { reason: parsed.data.reason },
        ...meta,
      })
      await tx.notification.create({
        data: {
          companyId: user.companyId,
          userId: existing.userId,
          title: "تم رفض طلب الإجازة",
          message: `رفض ${user.name} طلب ${existing.leaveType.name}: ${parsed.data.reason}`,
          type: "WARNING",
          entityType: "LeaveRequest",
          entityId: existing.id,
        },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    const updated = await prisma.leaveRequest.findUniqueOrThrow({
      where: { id: existing.id },
      include: leaveRequestInclude,
    })
    return ok({ request: serializeLeaveRequest(updated) })
  } catch (error) {
    return handleApiError(error, "LEAVE_REJECT_ERROR", "تعذر رفض طلب الإجازة")
  }
}
