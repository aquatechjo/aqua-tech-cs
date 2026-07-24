import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import {
  ACCESS_ROLES,
  assertRole,
  canViewCompanyHr,
} from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { currentBusinessYear } from "@/lib/hr"
import { activeEmployee, nullableHrText, serializeLeaveBalance } from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const adjustmentSchema = z.object({
  userId: z.string().trim().min(1),
  leaveTypeId: z.string().trim().min(1),
  year: z.coerce.number().int().min(2000).max(2200),
  openingDays: z.coerce.number().min(0).max(366).optional(),
  accruedDays: z.coerce.number().min(0).max(366).optional(),
  adjustedDays: z.coerce.number().min(-366).max(366).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const url = new URL(request.url)
    const year = Number(
      url.searchParams.get("year") || currentBusinessYear(new Date(), user.company.timezone),
    )
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      throw new ApiError("السنة غير صحيحة", 400, "INVALID_YEAR")
    }
    const requestedUserId = url.searchParams.get("userId")
    const canViewAll = canViewCompanyHr(user.role)
    const balances = await prisma.leaveBalance.findMany({
      where: {
        companyId: user.companyId,
        year,
        ...(canViewAll
          ? requestedUserId ? { userId: requestedUserId } : {}
          : { userId: user.id }),
      },
      orderBy: [{ user: { name: "asc" } }, { leaveType: { name: "asc" } }],
      include: {
        user: { select: { id: true, name: true, email: true } },
        leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
      },
    })
    return ok({ canViewAll, balances: balances.map((balance) => serializeLeaveBalance(balance)) })
  } catch (error) {
    return handleApiError(error, "LEAVE_BALANCES_GET_ERROR")
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.hrManagement)
    const parsed = adjustmentSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError("بيانات رصيد الإجازة غير صحيحة", 400, "VALIDATION_ERROR", {
        details: parsed.error.flatten(),
      })
    }
    await activeEmployee(prisma, user.companyId, parsed.data.userId)
    const leaveType = await prisma.leaveType.findFirst({
      where: { id: parsed.data.leaveTypeId, companyId: user.companyId },
    })
    if (!leaveType) throw new ApiError("نوع الإجازة غير موجود", 404, "LEAVE_TYPE_NOT_FOUND")
    const meta = await getRequestMeta()

    const balance = await prisma.$transaction(async (tx) => {
      const existing = await tx.leaveBalance.findUnique({
        where: {
          companyId_userId_leaveTypeId_year: {
            companyId: user.companyId,
            userId: parsed.data.userId,
            leaveTypeId: leaveType.id,
            year: parsed.data.year,
          },
        },
      })
      const updated = await tx.leaveBalance.upsert({
        where: {
          companyId_userId_leaveTypeId_year: {
            companyId: user.companyId,
            userId: parsed.data.userId,
            leaveTypeId: leaveType.id,
            year: parsed.data.year,
          },
        },
        update: {
          ...(parsed.data.openingDays !== undefined ? { openingDays: parsed.data.openingDays } : {}),
          ...(parsed.data.accruedDays !== undefined ? { accruedDays: parsed.data.accruedDays } : {}),
          ...(parsed.data.adjustedDays !== undefined ? { adjustedDays: parsed.data.adjustedDays } : {}),
          ...(parsed.data.notes !== undefined ? { notes: nullableHrText(parsed.data.notes) } : {}),
        },
        create: {
          companyId: user.companyId,
          userId: parsed.data.userId,
          leaveTypeId: leaveType.id,
          year: parsed.data.year,
          openingDays: parsed.data.openingDays ?? 0,
          accruedDays: parsed.data.accruedDays ?? Number(leaveType.annualAllowanceDays),
          adjustedDays: parsed.data.adjustedDays ?? 0,
          notes: nullableHrText(parsed.data.notes),
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
        },
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.LEAVE_BALANCE_ADJUSTED,
        entityType: "LeaveBalance",
        entityId: updated.id,
        message: `تم تعديل رصيد ${updated.user.name} - ${updated.leaveType.name}`,
        metadata: {
          year: updated.year,
          before: existing
            ? {
                openingDays: existing.openingDays.toString(),
                accruedDays: existing.accruedDays.toString(),
                adjustedDays: existing.adjustedDays.toString(),
                usedDays: existing.usedDays.toString(),
              }
            : null,
          after: {
            openingDays: updated.openingDays.toString(),
            accruedDays: updated.accruedDays.toString(),
            adjustedDays: updated.adjustedDays.toString(),
            usedDays: updated.usedDays.toString(),
          },
        },
        ...meta,
      })
      return updated
    })

    return ok({ balance: serializeLeaveBalance(balance) })
  } catch (error) {
    return handleApiError(error, "LEAVE_BALANCE_PATCH_ERROR", "تعذر تعديل رصيد الإجازة")
  }
}
