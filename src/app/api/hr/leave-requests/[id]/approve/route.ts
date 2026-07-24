import { Prisma } from "@/generated/prisma/client"
import { ActivityAction } from "@/generated/prisma/enums"
import { assertCanApproveLeave } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { availableLeaveDays, canTransitionLeave } from "@/lib/hr"
import {
  assertNoApprovedAttendanceConflict,
  ensureLeaveBalance,
  leaveRequestInclude,
  requestYear,
  serializeLeaveRequest,
} from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const { id } = await params
    const existing = await prisma.leaveRequest.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        user: { select: { id: true, name: true } },
        leaveType: true,
      },
    })
    if (!existing) throw new ApiError("طلب الإجازة غير موجود", 404, "LEAVE_REQUEST_NOT_FOUND")
    assertCanApproveLeave(user, existing.userId)
    if (!canTransitionLeave(existing.status, "APPROVED")) {
      throw new ApiError("لا يمكن اعتماد الطلب بحالته الحالية", 409, "INVALID_LEAVE_TRANSITION")
    }

    const startKey = existing.startDate.toISOString().slice(0, 10)
    const endKey = existing.endDate.toISOString().slice(0, 10)
    await assertNoApprovedAttendanceConflict(prisma, {
      companyId: user.companyId,
      userId: existing.userId,
      startKey,
      endKey,
    })

    const year = requestYear(existing)
    const totalDays = Number(existing.totalDays)
    const allowance = Number(existing.leaveType.annualAllowanceDays)
    const meta = await getRequestMeta()

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.leaveRequest.updateMany({
        where: { id: existing.id, companyId: user.companyId, status: "PENDING" },
        data: {
          status: "APPROVED",
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNote: null,
        },
      })
      if (claimed.count !== 1) {
        throw new ApiError(
          "تمت معالجة طلب الإجازة من مستخدم آخر",
          409,
          "LEAVE_REQUEST_ALREADY_PROCESSED",
        )
      }

      if (allowance > 0) {
        const balance = await ensureLeaveBalance(tx, {
          companyId: user.companyId,
          userId: existing.userId,
          leaveTypeId: existing.leaveTypeId,
          year,
          annualAllowanceDays: allowance,
        })
        const available = availableLeaveDays({
          openingDays: Number(balance.openingDays),
          accruedDays: Number(balance.accruedDays),
          adjustedDays: Number(balance.adjustedDays),
          usedDays: Number(balance.usedDays),
        })
        if (available < totalDays) {
          throw new ApiError(
            `الرصيد المتاح ${available} يوم فقط`,
            409,
            "INSUFFICIENT_LEAVE_BALANCE",
          )
        }
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { usedDays: { increment: totalDays } },
        })
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.LEAVE_REQUEST_APPROVED,
        entityType: "LeaveRequest",
        entityId: existing.id,
        message: `تم اعتماد طلب إجازة ${existing.user.name}`,
        metadata: { totalDays, startKey, endKey, leaveTypeId: existing.leaveTypeId },
        ...meta,
      })
      await tx.notification.create({
        data: {
          companyId: user.companyId,
          userId: existing.userId,
          title: "تم اعتماد طلب الإجازة",
          message: `اعتمد ${user.name} طلب ${existing.leaveType.name} من ${startKey} إلى ${endKey}`,
          type: "SUCCESS",
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
    return handleApiError(error, "LEAVE_APPROVE_ERROR", "تعذر اعتماد طلب الإجازة")
  }
}
