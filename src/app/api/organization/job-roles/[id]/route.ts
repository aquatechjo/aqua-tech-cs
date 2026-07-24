import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { normalizeOrganizationCode } from "@/lib/organization"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const updateJobRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    code: z.string().trim().min(2).max(50).optional(),
    departmentId: z.string().trim().optional().nullable(),
    description: z.string().trim().max(500).optional().or(z.literal("")),
    isActive: z.boolean().optional(),
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
      "لا تملك صلاحية تعديل المسميات الوظيفية"
    )

    const { id } = await params
    const parsed = updateJobRoleSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      return err(
        "بيانات المسمى الوظيفي غير صحيحة",
        400,
        parsed.error.flatten()
      )
    }

    const current = await prisma.jobRole.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, name: true, code: true },
    })

    if (!current) {
      return err("المسمى الوظيفي غير موجود", 404)
    }

    const code = parsed.data.code
      ? normalizeOrganizationCode(parsed.data.code)
      : undefined

    if (code !== undefined && code.length < 2) {
      return err("رمز المسمى يجب أن يحتوي أحرفًا أو أرقامًا إنجليزية", 400)
    }

    if (code && code !== current.code) {
      const duplicate = await prisma.jobRole.findUnique({
        where: { companyId_code: { companyId: user.companyId, code } },
        select: { id: true },
      })

      if (duplicate) {
        return err("يوجد مسمى وظيفي بهذا الرمز", 409)
      }
    }

    const departmentId = parsed.data.departmentId || null

    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, companyId: user.companyId },
        select: { id: true },
      })

      if (!department) {
        return err("القسم المحدد غير موجود", 400)
      }
    }

    const meta = await getRequestMeta()
    const jobRole = await prisma.$transaction(async (tx) => {
      const updated = await tx.jobRole.update({
        where: { id },
        data: {
          name: parsed.data.name,
          code,
          departmentId:
            parsed.data.departmentId === undefined
              ? undefined
              : departmentId,
          description:
            parsed.data.description === undefined
              ? undefined
              : parsed.data.description || null,
          isActive: parsed.data.isActive,
        },
      })

      await logActivity({
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.JOB_ROLE_UPDATED,
        entityType: "JobRole",
        entityId: updated.id,
        message: `تم تعديل مسمى وظيفي: ${updated.name}`,
        metadata: { changedFields: Object.keys(parsed.data) },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      return updated
    })

    return ok({ jobRole })
  } catch (error) {
    return handleApiError(
      error,
      "JOB_ROLES_PATCH_ERROR",
      "حدث خطأ أثناء تعديل المسمى الوظيفي"
    )
  }
}
