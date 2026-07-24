import { Prisma } from "@/generated/prisma/client"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { localDateKey } from "@/lib/finance"
import { canTransitionLeave } from "@/lib/hr"
import {
  leaveRequestInclude,
  requestYear,
  serializeLeaveRequest,
} from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const { id } = await params
    const existing = await prisma.leaveRequest.findFirst({
      where: { id, companyId: user.companyId },
      include: { leaveType: true, user: { select: { id: true, name: true } } },
    })
    if (!existing) throw new ApiError("طلب الإجازة غير موجود", 404, "LEAVE_REQUEST_NOT_FOUND")
    const canManage = hasRole(user.role, ACCESS_ROLES.leaveApproval)
    if (existing.userId !== user.id && !canManage) {
      throw new ApiError("لا تملك صلاحية إلغاء هذا الطلب", 403, "LEAVE_CANCEL_FORBIDDEN")
    }
    if (!canTransitionLeave(existing.status, "CANCELLED")) {
      throw new ApiError("لا يمكن إلغاء الطلب بحالته الحالية", 409, "INVALID_LEAVE_TRANSITION")
    }
    const today = localDateKey(new Date(), user.company.timezone)
    const startKey = existing.startDate.toISOString().slice(0, 10)
    if (startKey < today) {
      throw new ApiError("لا يمكن إلغاء إجازة بدأت بالفعل", 409, "STARTED_LEAVE_CANNOT_CANCEL")
    }
    const meta = await getRequestMeta()
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.leaveRequest.updateMany({
        where: {
          id: existing.id,
          companyId: user.companyId,
          status: existing.status,
        },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      })
      if (claimed.count !== 1) {
        throw new ApiError(
          "تمت معالجة طلب الإجازة من مستخدم آخر",
          409,
          "LEAVE_REQUEST_ALREADY_PROCESSED",
        )
      }

      if (existing.status === "APPROVED" && Number(existing.leaveType.annualAllowanceDays) > 0) {
        const balance = await tx.leaveBalance.findUnique({
          where: {
            companyId_userId_leaveTypeId_year: {
              companyId: user.companyId,
              userId: existing.userId,
              leaveTypeId: existing.leaveTypeId,
              year: requestYear(existing),
            },
          },
        })
        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { usedDays: { decrement: Number(existing.totalDays) } },
          })
        }
      }
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.LEAVE_REQUEST_CANCELLED,
        entityType: "LeaveRequest",
        entityId: existing.id,
        message: `تم إلغاء طلب إجازة ${existing.user.name}`,
        metadata: { previousStatus: existing.status, totalDays: existing.totalDays.toString() },
        ...meta,
      })
      if (existing.userId !== user.id) {
        await tx.notification.create({
          data: {
            companyId: user.companyId,
            userId: existing.userId,
            title: "تم إلغاء طلب الإجازة",
            message: `ألغى ${user.name} طلب ${existing.leaveType.name}`,
            type: "WARNING",
            entityType: "LeaveRequest",
            entityId: existing.id,
          },
        })
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    const updated = await prisma.leaveRequest.findUniqueOrThrow({
      where: { id: existing.id },
      include: leaveRequestInclude,
    })
    return ok({ request: serializeLeaveRequest(updated) })
  } catch (error) {
    return handleApiError(error, "LEAVE_CANCEL_ERROR", "تعذر إلغاء طلب الإجازة")
  }
}
