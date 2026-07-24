import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { normalizeOrganizationCode } from "@/lib/organization"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const updateTeamSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    code: z.string().trim().min(2).max(50).optional(),
    departmentId: z.string().trim().optional().nullable(),
    leadProfileId: z.string().trim().optional().nullable(),
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
      "لا تملك صلاحية تعديل الفرق"
    )

    const { id } = await params
    const parsed = updateTeamSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      return err("بيانات الفريق غير صحيحة", 400, parsed.error.flatten())
    }

    const current = await prisma.team.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, name: true, code: true },
    })

    if (!current) {
      return err("الفريق غير موجود", 404)
    }

    const code = parsed.data.code
      ? normalizeOrganizationCode(parsed.data.code)
      : undefined

    if (code !== undefined && code.length < 2) {
      return err("رمز الفريق يجب أن يحتوي أحرفًا أو أرقامًا إنجليزية", 400)
    }

    if (code && code !== current.code) {
      const duplicate = await prisma.team.findUnique({
        where: { companyId_code: { companyId: user.companyId, code } },
        select: { id: true },
      })

      if (duplicate) {
        return err("يوجد فريق بهذا الرمز", 409)
      }
    }

    const departmentId = parsed.data.departmentId || null
    const leadProfileId = parsed.data.leadProfileId || null

    const [department, leadProfile] = await Promise.all([
      departmentId
        ? prisma.department.findFirst({
            where: { id: departmentId, companyId: user.companyId },
            select: { id: true },
          })
        : Promise.resolve(null),
      leadProfileId
        ? prisma.employeeProfile.findFirst({
            where: { id: leadProfileId, companyId: user.companyId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ])

    if (departmentId && !department) {
      return err("القسم المحدد غير موجود", 400)
    }

    if (leadProfileId && !leadProfile) {
      return err("قائد الفريق المحدد غير موجود", 400)
    }

    const meta = await getRequestMeta()
    const team = await prisma.$transaction(async (tx) => {
      const updated = await tx.team.update({
        where: { id },
        data: {
          name: parsed.data.name,
          code,
          departmentId:
            parsed.data.departmentId === undefined
              ? undefined
              : departmentId,
          leadProfileId:
            parsed.data.leadProfileId === undefined
              ? undefined
              : leadProfileId,
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
        action: ActivityAction.TEAM_UPDATED,
        entityType: "Team",
        entityId: updated.id,
        message: `تم تعديل فريق: ${updated.name}`,
        metadata: { changedFields: Object.keys(parsed.data) },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      return updated
    })

    return ok({ team })
  } catch (error) {
    return handleApiError(
      error,
      "ORGANIZATION_TEAMS_PATCH_ERROR",
      "حدث خطأ أثناء تعديل الفريق"
    )
  }
}
