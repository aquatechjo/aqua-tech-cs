import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { ActivityAction } from "@/generated/prisma/enums"
import { canViewCompanyHr } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { localDateKey } from "@/lib/finance"
import {
  assertNoLeaveOverlap,
  calculateEmployeeLeaveDays,
  leaveApprovers,
  nullableHrText,
  serializeLeaveRequest,
  leaveRequestInclude,
} from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { dateKeyToUtc } from "@/lib/time"

const requestSchema = z.object({
  leaveTypeId: z.string().trim().min(1),
  startDate: z.string().trim(),
  endDate: z.string().trim(),
  startPortion: z.enum(["FULL_DAY", "FIRST_HALF", "SECOND_HALF"]).default("FULL_DAY"),
  endPortion: z.enum(["FULL_DAY", "FIRST_HALF", "SECOND_HALF"]).default("FULL_DAY"),
  reason: z.string().trim().max(1000).optional().nullable(),
})

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const url = new URL(request.url)
    const canViewAll = canViewCompanyHr(user.role)
    const requestedUserId = url.searchParams.get("userId")
    const status = url.searchParams.get("status")
    const validStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const
    if (status && !validStatuses.includes(status as (typeof validStatuses)[number])) {
      throw new ApiError("حالة الطلب غير صحيحة", 400, "INVALID_LEAVE_STATUS")
    }
    const requests = await prisma.leaveRequest.findMany({
      where: {
        companyId: user.companyId,
        ...(canViewAll
          ? requestedUserId ? { userId: requestedUserId } : {}
          : { userId: user.id }),
        ...(status ? { status: status as (typeof validStatuses)[number] } : {}),
      },
      orderBy: [{ submittedAt: "desc" }],
      include: leaveRequestInclude,
      take: 200,
    })
    return ok({ canViewAll, requests: requests.map((item) => serializeLeaveRequest(item)) })
  } catch (error) {
    return handleApiError(error, "LEAVE_REQUESTS_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const parsed = requestSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError("بيانات طلب الإجازة غير صحيحة", 400, "VALIDATION_ERROR", {
        details: parsed.error.flatten(),
      })
    }
    const today = localDateKey(new Date(), user.company.timezone)
    if (parsed.data.startDate < today) {
      throw new ApiError("لا يمكن تقديم طلب يبدأ بتاريخ ماضٍ", 400, "PAST_LEAVE_REQUEST")
    }
    if (parsed.data.startDate.slice(0, 4) !== parsed.data.endDate.slice(0, 4)) {
      throw new ApiError("قسّم الإجازة التي تتجاوز سنة إلى طلبين", 400, "CROSS_YEAR_LEAVE_REQUEST")
    }
    const startDate = dateKeyToUtc(parsed.data.startDate)
    const endDate = dateKeyToUtc(parsed.data.endDate)
    const leaveType = await prisma.leaveType.findFirst({
      where: { id: parsed.data.leaveTypeId, companyId: user.companyId, isActive: true },
    })
    if (!leaveType) throw new ApiError("نوع الإجازة غير موجود أو غير نشط", 404, "LEAVE_TYPE_NOT_FOUND")

    await assertNoLeaveOverlap(prisma, {
      companyId: user.companyId,
      userId: user.id,
      startDate,
      endDate,
    })
    const { totalDays } = await calculateEmployeeLeaveDays(prisma, {
      companyId: user.companyId,
      userId: user.id,
      startKey: parsed.data.startDate,
      endKey: parsed.data.endDate,
      startPortion: parsed.data.startPortion,
      endPortion: parsed.data.endPortion,
    })
    const meta = await getRequestMeta()

    const createdId = await prisma.$transaction(async (tx) => {
      await assertNoLeaveOverlap(tx, {
        companyId: user.companyId,
        userId: user.id,
        startDate,
        endDate,
      })
      const created = await tx.leaveRequest.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          leaveTypeId: leaveType.id,
          startDate,
          endDate,
          startPortion: parsed.data.startPortion,
          endPortion: parsed.data.endPortion,
          totalDays,
          reason: nullableHrText(parsed.data.reason),
        },
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.LEAVE_REQUEST_SUBMITTED,
        entityType: "LeaveRequest",
        entityId: created.id,
        message: `تم تقديم طلب ${leaveType.name} لمدة ${totalDays} يوم`,
        metadata: {
          leaveTypeId: leaveType.id,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          totalDays,
        },
        ...meta,
      })
      const approvers = await leaveApprovers(tx, user.companyId, user.id)
      if (approvers.length) {
        await tx.notification.createMany({
          data: approvers.map((approver) => ({
            companyId: user.companyId,
            userId: approver.id,
            title: "طلب إجازة جديد",
            message: `${user.name} قدّم طلب ${leaveType.name} لمدة ${totalDays} يوم`,
            type: "INFO" as const,
            entityType: "LeaveRequest",
            entityId: created.id,
          })),
        })
      }
      return created.id
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    const created = await prisma.leaveRequest.findUniqueOrThrow({
      where: { id: createdId },
      include: leaveRequestInclude,
    })
    return ok({ request: serializeLeaveRequest(created) }, 201)
  } catch (error) {
    return handleApiError(error, "LEAVE_REQUESTS_POST_ERROR", "تعذر تقديم طلب الإجازة")
  }
}
