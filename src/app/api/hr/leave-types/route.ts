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

const leaveTypeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(1).max(32),
  description: z.string().trim().max(500).optional().nullable(),
  annualAllowanceDays: z.coerce.number().min(0).max(366),
  carryoverLimitDays: z.coerce.number().min(0).max(366).default(0),
  isPaid: z.boolean().optional().default(true),
  requiresApproval: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
})

function serializeType(type: {
  id: string
  name: string
  code: string
  description: string | null
  annualAllowanceDays: { toString(): string }
  carryoverLimitDays: { toString(): string }
  isPaid: boolean
  requiresApproval: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...type,
    annualAllowanceDays: type.annualAllowanceDays.toString(),
    carryoverLimitDays: type.carryoverLimitDays.toString(),
    createdAt: type.createdAt.toISOString(),
    updatedAt: type.updatedAt.toISOString(),
  }
}

export async function GET() {
  try {
    const user = await requireAuth()
    const types = await prisma.leaveType.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        annualAllowanceDays: true,
        carryoverLimitDays: true,
        isPaid: true,
        requiresApproval: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return ok({ leaveTypes: types.map((type) => serializeType(type)) })
  } catch (error) {
    return handleApiError(error, "LEAVE_TYPES_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.hrManagement)
    const parsed = leaveTypeSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError("بيانات نوع الإجازة غير صحيحة", 400, "VALIDATION_ERROR", {
        details: parsed.error.flatten(),
      })
    }
    const meta = await getRequestMeta()
    const type = await prisma.$transaction(async (tx) => {
      const created = await tx.leaveType.create({
        data: {
          companyId: user.companyId,
          name: parsed.data.name,
          code: normalizeLeaveTypeCode(parsed.data.code),
          description: nullableHrText(parsed.data.description),
          annualAllowanceDays: parsed.data.annualAllowanceDays,
          carryoverLimitDays: parsed.data.carryoverLimitDays,
          isPaid: parsed.data.isPaid,
          requiresApproval: parsed.data.requiresApproval,
          isActive: parsed.data.isActive,
        },
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.LEAVE_TYPE_CREATED,
        entityType: "LeaveType",
        entityId: created.id,
        message: `تم إنشاء نوع الإجازة ${created.name}`,
        metadata: { code: created.code, allowance: created.annualAllowanceDays.toString() },
        ...meta,
      })
      return created
    })
    return ok({ leaveType: serializeType(type) }, 201)
  } catch (error) {
    return handleApiError(error, "LEAVE_TYPES_POST_ERROR", "تعذر إنشاء نوع الإجازة")
  }
}
