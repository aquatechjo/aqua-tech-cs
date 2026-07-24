import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { normalizeOrganizationCode } from "@/lib/organization"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const departmentSchema = z.object({
  name: z.string().trim().min(2, "اسم القسم مطلوب").max(80),
  code: z.string().trim().min(2, "رمز القسم مطلوب").max(50),
  description: z.string().trim().max(500).optional().or(z.literal("")),
})

export async function GET() {
  try {
    const user = await requireAuth()

    const departments = await prisma.department.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        leadProfile: {
          select: {
            id: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: {
          select: { employeeProfiles: true, jobRoles: true, teams: true },
        },
      },
    })

    return ok({ departments })
  } catch (error) {
    return handleApiError(error, "DEPARTMENTS_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.organizationManagement,
      "لا تملك صلاحية إضافة الأقسام"
    )

    const parsed = departmentSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      return err("بيانات القسم غير صحيحة", 400, parsed.error.flatten())
    }

    const code = normalizeOrganizationCode(parsed.data.code)

    if (code.length < 2) {
      return err("رمز القسم يجب أن يحتوي أحرفًا أو أرقامًا إنجليزية", 400)
    }

    const duplicate = await prisma.department.findUnique({
      where: {
        companyId_code: { companyId: user.companyId, code },
      },
      select: { id: true },
    })

    if (duplicate) {
      return err("يوجد قسم بهذا الرمز", 409)
    }

    const meta = await getRequestMeta()
    const department = await prisma.$transaction(async (tx) => {
      const created = await tx.department.create({
        data: {
          companyId: user.companyId,
          name: parsed.data.name,
          code,
          description: parsed.data.description || null,
        },
      })

      await logActivity({
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.DEPARTMENT_CREATED,
        entityType: "Department",
        entityId: created.id,
        message: `تم إنشاء قسم: ${created.name}`,
        metadata: { code: created.code },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      return created
    })

    return ok({ department }, 201)
  } catch (error) {
    return handleApiError(
      error,
      "DEPARTMENTS_POST_ERROR",
      "حدث خطأ أثناء إضافة القسم"
    )
  }
}
