import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole, hasRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const patchSchema = z
  .object({
    workHoursPerWeek: z.union([z.string(), z.number()]).optional(),
    hourlyCost: z.union([z.string(), z.number()]).optional(),
    billableRate: z.union([z.string(), z.number()]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "لا توجد تعديلات")

function decimalValue(
  value: string | number | undefined,
  {
    field,
    max,
  }: {
    field: string
    max: number
  },
) {
  if (value === undefined) return undefined
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > max) {
    throw new ApiError(
      `${field} يجب أن يكون بين 0 و${max}`,
      400,
      "INVALID_TIME_PROFILE_VALUE",
    )
  }
  return Math.round(number * 100) / 100
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const { userId } = await params
    const parsed = patchSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات ملف الوقت غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    const changesCapacity = parsed.data.workHoursPerWeek !== undefined
    const changesRates =
      parsed.data.hourlyCost !== undefined ||
      parsed.data.billableRate !== undefined

    if (changesCapacity) {
      assertRole(
        user.role,
        ACCESS_ROLES.timeCapacityManagement,
        "لا تملك صلاحية تعديل الطاقة الأسبوعية",
      )
    }
    if (changesRates) {
      assertRole(
        user.role,
        ACCESS_ROLES.timeRateManagement,
        "لا تملك صلاحية تعديل تكاليف وأسعار الوقت",
      )
    }

    const workHoursPerWeek = decimalValue(parsed.data.workHoursPerWeek, {
      field: "الساعات الأسبوعية",
      max: 168,
    })
    const hourlyCost = decimalValue(parsed.data.hourlyCost, {
      field: "التكلفة بالساعة",
      max: 1_000_000,
    })
    const billableRate = decimalValue(parsed.data.billableRate, {
      field: "سعر البيع بالساعة",
      max: 1_000_000,
    })

    const existing = await prisma.employeeProfile.findFirst({
      where: {
        companyId: user.companyId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
    if (!existing) {
      throw new ApiError(
        "ملف الموظف غير موجود",
        404,
        "EMPLOYEE_PROFILE_NOT_FOUND",
      )
    }

    const meta = await getRequestMeta()

    const updated = await prisma.$transaction(async (tx) => {
      const profile = await tx.employeeProfile.update({
        where: { id: existing.id },
        data: {
          ...(workHoursPerWeek !== undefined ? { workHoursPerWeek } : {}),
          ...(hourlyCost !== undefined ? { hourlyCost } : {}),
          ...(billableRate !== undefined ? { billableRate } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.EMPLOYEE_PROFILE_UPDATED,
        entityType: "EmployeeProfile",
        entityId: existing.id,
        message: `تم تحديث إعدادات الوقت للموظف ${existing.user.name}`,
        metadata: {
          targetUserId: existing.userId,
          workHoursPerWeek:
            workHoursPerWeek ?? Number(existing.workHoursPerWeek),
          hourlyCost:
            hourlyCost ?? Number(existing.hourlyCost),
          billableRate:
            billableRate ?? Number(existing.billableRate),
          ratesChanged: changesRates,
          capacityChanged: changesCapacity,
        },
        ...meta,
      })

      return profile
    })

    return ok({
      profile: {
        id: updated.id,
        user: updated.user,
        workHoursPerWeek: updated.workHoursPerWeek.toString(),
        hourlyCost: hasRole(user.role, ACCESS_ROLES.timeCostRead)
          ? updated.hourlyCost.toString()
          : null,
        billableRate: hasRole(user.role, ACCESS_ROLES.timeCostRead)
          ? updated.billableRate.toString()
          : null,
      },
    })
  } catch (error) {
    return handleApiError(
      error,
      "TIME_PROFILE_PATCH_ERROR",
      "تعذر تحديث إعدادات الوقت",
    )
  }
}
