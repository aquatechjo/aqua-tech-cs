import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { normalizeLeaveTypeCode } from "@/lib/hr"
import { nullableHrText } from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const patchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  code: z.string().trim().min(1).max(32).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  annualAllowanceDays: z.coerce.number().min(0).max(366).optional(),
  carryoverLimitDays: z.coerce.number().min(0).max(366).optional(),
  isPaid: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.hrManagement)
    const { id } = await params
    const existing = await prisma.leaveType.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw new ApiError("نوع الإجازة غير موجود", 404, "LEAVE_TYPE_NOT_FOUND")
    const parsed = patchSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError("بيانات نوع الإجازة غير صحيحة", 400, "VALIDATION_ERROR", {
        details: parsed.error.flatten(),
      })
    }
    const meta = await getRequestMeta()
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.leaveType.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.code !== undefined
            ? { code: normalizeLeaveTypeCode(parsed.data.code) }
            : {}),
          ...(parsed.data.description !== undefined
            ? { description: nullableHrText(parsed.data.description) }
            : {}),
          ...(parsed.data.annualAllowanceDays !== undefined
            ? { annualAllowanceDays: parsed.data.annualAllowanceDays }
            : {}),
          ...(parsed.data.carryoverLimitDays !== undefined
            ? { carryoverLimitDays: parsed.data.carryoverLimitDays }
            : {}),
          ...(parsed.data.isPaid !== undefined ? { isPaid: parsed.data.isPaid } : {}),
          ...(parsed.data.requiresApproval !== undefined
            ? { requiresApproval: parsed.data.requiresApproval }
            : {}),
          ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        },
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.LEAVE_TYPE_UPDATED,
        entityType: "LeaveType",
        entityId: result.id,
        message: `تم تعديل نوع الإجازة ${result.name}`,
        metadata: {
          before: {
            name: existing.name,
            code: existing.code,
            annualAllowanceDays: existing.annualAllowanceDays.toString(),
            isActive: existing.isActive,
          },
          after: {
            name: result.name,
            code: result.code,
            annualAllowanceDays: result.annualAllowanceDays.toString(),
            isActive: result.isActive,
          },
        },
        ...meta,
      })
      return result
    })
    return ok({
      leaveType: {
        ...updated,
        annualAllowanceDays: updated.annualAllowanceDays.toString(),
        carryoverLimitDays: updated.carryoverLimitDays.toString(),
      },
    })
  } catch (error) {
    return handleApiError(error, "LEAVE_TYPE_PATCH_ERROR", "تعذر تعديل نوع الإجازة")
  }
}
