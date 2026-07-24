import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { normalizeOrganizationCode } from "@/lib/organization"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const updateDepartmentSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    code: z.string().trim().min(2).max(50).optional(),
    description: z.string().trim().max(500).optional().or(z.literal("")),
    isActive: z.boolean().optional(),
    leadProfileId: z.string().trim().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "لا توجد تعديلات للحفظ",
  })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.organizationManagement,
      "لا تملك صلاحية تعديل الأقسام"
    )

    const { id } = await params
    const parsed = updateDepartmentSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      return err("بيانات القسم غير صحيحة", 400, parsed.error.flatten())
    }

    const current = await prisma.department.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, name: true, code: true },
    })

    if (!current) {
      return err("القسم غير موجود", 404)
    }

    const code = parsed.data.code
      ? normalizeOrganizationCode(parsed.data.code)
      : undefined

    if (code !== undefined && code.length < 2) {
      return err("رمز القسم يجب أن يحتوي أحرفًا أو أرقامًا إنجليزية", 400)
    }

    if (code && code !== current.code) {
      const duplicate = await prisma.department.findUnique({
        where: {
          companyId_code: { companyId: user.companyId, code },
        },
        select: { id: true },
      })

      if (duplicate) {
        return err("يوجد قسم بهذا الرمز", 409)
      }
    }

    const leadProfileId = parsed.data.leadProfileId || null

    if (leadProfileId) {
      const lead = await prisma.employeeProfile.findFirst({
        where: { id: leadProfileId, companyId: user.companyId },
        select: { id: true },
      })

      if (!lead) {
        return err("مدير القسم المحدد غير موجود", 400)
      }
    }

    const meta = await getRequestMeta()
    const department = await prisma.$transaction(async (tx) => {
      const updated = await tx.department.update({
        where: { id },
        data: {
          name: parsed.data.name,
          code,
          description:
            parsed.data.description === undefined
              ? undefined
              : parsed.data.description || null,
          isActive: parsed.data.isActive,
          leadProfileId:
            parsed.data.leadProfileId === undefined
              ? undefined
              : leadProfileId,
        },
      })

      await logActivity({
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.DEPARTMENT_UPDATED,
        entityType: "Department",
        entityId: updated.id,
        message: `تم تعديل قسم: ${updated.name}`,
        metadata: { changedFields: Object.keys(parsed.data) },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      return updated
    })

    return ok({ department })
  } catch (error) {
    return handleApiError(
      error,
      "DEPARTMENTS_PATCH_ERROR",
      "حدث خطأ أثناء تعديل القسم"
    )
  }
}
