import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { normalizeOrganizationCode } from "@/lib/organization"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const jobRoleSchema = z.object({
  name: z.string().trim().min(2, "اسم المسمى الوظيفي مطلوب").max(80),
  code: z.string().trim().min(2, "رمز المسمى مطلوب").max(50),
  departmentId: z.string().trim().optional().nullable(),
  description: z.string().trim().max(500).optional().or(z.literal("")),
})

export async function GET() {
  try {
    const user = await requireAuth()

    const jobRoles = await prisma.jobRole.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        department: { select: { id: true, name: true, code: true } },
        _count: { select: { employeeProfiles: true } },
      },
    })

    return ok({ jobRoles })
  } catch (error) {
    return handleApiError(error, "JOB_ROLES_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.organizationManagement,
      "لا تملك صلاحية إضافة المسميات الوظيفية"
    )

    const parsed = jobRoleSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      return err(
        "بيانات المسمى الوظيفي غير صحيحة",
        400,
        parsed.error.flatten()
      )
    }

    const code = normalizeOrganizationCode(parsed.data.code)

    if (code.length < 2) {
      return err("رمز المسمى يجب أن يحتوي أحرفًا أو أرقامًا إنجليزية", 400)
    }

    const departmentId = parsed.data.departmentId || null
    const [duplicate, department] = await Promise.all([
      prisma.jobRole.findUnique({
        where: { companyId_code: { companyId: user.companyId, code } },
        select: { id: true },
      }),
      departmentId
        ? prisma.department.findFirst({
            where: { id: departmentId, companyId: user.companyId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ])

    if (duplicate) {
      return err("يوجد مسمى وظيفي بهذا الرمز", 409)
    }

    if (departmentId && !department) {
      return err("القسم المحدد غير موجود", 400)
    }

    const meta = await getRequestMeta()
    const jobRole = await prisma.$transaction(async (tx) => {
      const created = await tx.jobRole.create({
        data: {
          companyId: user.companyId,
          departmentId,
          name: parsed.data.name,
          code,
          description: parsed.data.description || null,
        },
      })

      await logActivity({
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.JOB_ROLE_CREATED,
        entityType: "JobRole",
        entityId: created.id,
        message: `تم إنشاء مسمى وظيفي: ${created.name}`,
        metadata: { code: created.code, departmentId },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      return created
    })

    return ok({ jobRole }, 201)
  } catch (error) {
    return handleApiError(
      error,
      "JOB_ROLES_POST_ERROR",
      "حدث خطأ أثناء إضافة المسمى الوظيفي"
    )
  }
}
