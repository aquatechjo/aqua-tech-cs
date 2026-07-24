import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { activeEmployee } from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const schema = z.object({ workScheduleId: z.string().trim().optional().nullable() })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.workScheduleManagement)
    const { userId } = await params
    const parsed = schema.safeParse(await readJsonBody(request))
    if (!parsed.success) throw new ApiError("جدول الدوام غير صحيح", 400, "VALIDATION_ERROR")
    const employee = await activeEmployee(prisma, user.companyId, userId)
    if (!employee.employeeProfile) {
      throw new ApiError("الملف الوظيفي غير موجود", 404, "EMPLOYEE_PROFILE_NOT_FOUND")
    }
    const scheduleId = parsed.data.workScheduleId || null
    if (scheduleId) {
      const schedule = await prisma.workSchedule.findFirst({
        where: { id: scheduleId, companyId: user.companyId, isActive: true },
        select: { id: true },
      })
      if (!schedule) throw new ApiError("جدول الدوام غير موجود أو غير نشط", 404, "WORK_SCHEDULE_NOT_FOUND")
    }
    const meta = await getRequestMeta()
    const profile = await prisma.$transaction(async (tx) => {
      const updated = await tx.employeeProfile.update({
        where: { id: employee.employeeProfile!.id },
        data: { workScheduleId: scheduleId },
        include: { workSchedule: true },
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.EMPLOYEE_PROFILE_UPDATED,
        entityType: "EmployeeProfile",
        entityId: updated.id,
        message: `تم تعديل جدول دوام ${employee.name}`,
        metadata: {
          beforeWorkScheduleId: employee.employeeProfile!.workScheduleId,
          afterWorkScheduleId: scheduleId,
        },
        ...meta,
      })
      return updated
    })
    return ok({ profile })
  } catch (error) {
    return handleApiError(error, "EMPLOYEE_SCHEDULE_PATCH_ERROR", "تعذر تعديل جدول الموظف")
  }
}
