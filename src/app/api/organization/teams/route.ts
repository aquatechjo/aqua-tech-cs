import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { normalizeOrganizationCode } from "@/lib/organization"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const teamSchema = z.object({
  name: z.string().trim().min(2, "اسم الفريق مطلوب").max(80),
  code: z.string().trim().min(2, "رمز الفريق مطلوب").max(50),
  departmentId: z.string().trim().optional().nullable(),
  leadProfileId: z.string().trim().optional().nullable(),
  description: z.string().trim().max(500).optional().or(z.literal("")),
})

async function validateRelations(
  companyId: string,
  departmentId: string | null,
  leadProfileId: string | null
) {
  const [department, leadProfile] = await Promise.all([
    departmentId
      ? prisma.department.findFirst({
          where: { id: departmentId, companyId },
          select: { id: true },
        })
      : Promise.resolve(null),
    leadProfileId
      ? prisma.employeeProfile.findFirst({
          where: { id: leadProfileId, companyId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ])

  if (departmentId && !department) {
    return "القسم المحدد غير موجود"
  }

  if (leadProfileId && !leadProfile) {
    return "قائد الفريق المحدد غير موجود"
  }

  return null
}

export async function GET() {
  try {
    const user = await requireAuth()

    const teams = await prisma.team.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        department: { select: { id: true, name: true, code: true } },
        leadProfile: {
          select: {
            id: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        memberships: {
          orderBy: { createdAt: "asc" },
          include: {
            employeeProfile: {
              select: {
                id: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    })

    return ok({ teams })
  } catch (error) {
    return handleApiError(error, "ORGANIZATION_TEAMS_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.organizationManagement,
      "لا تملك صلاحية إضافة الفرق"
    )

    const parsed = teamSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      return err("بيانات الفريق غير صحيحة", 400, parsed.error.flatten())
    }

    const code = normalizeOrganizationCode(parsed.data.code)

    if (code.length < 2) {
      return err("رمز الفريق يجب أن يحتوي أحرفًا أو أرقامًا إنجليزية", 400)
    }

    const departmentId = parsed.data.departmentId || null
    const leadProfileId = parsed.data.leadProfileId || null
    const [duplicate, relationError] = await Promise.all([
      prisma.team.findUnique({
        where: { companyId_code: { companyId: user.companyId, code } },
        select: { id: true },
      }),
      validateRelations(user.companyId, departmentId, leadProfileId),
    ])

    if (duplicate) {
      return err("يوجد فريق بهذا الرمز", 409)
    }

    if (relationError) {
      return err(relationError, 400)
    }

    const meta = await getRequestMeta()
    const team = await prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          companyId: user.companyId,
          departmentId,
          leadProfileId,
          name: parsed.data.name,
          code,
          description: parsed.data.description || null,
        },
      })

      await logActivity({
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TEAM_CREATED,
        entityType: "Team",
        entityId: created.id,
        message: `تم إنشاء فريق: ${created.name}`,
        metadata: { code: created.code, departmentId, leadProfileId },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      return created
    })

    return ok({ team }, 201)
  } catch (error) {
    return handleApiError(
      error,
      "ORGANIZATION_TEAMS_POST_ERROR",
      "حدث خطأ أثناء إضافة الفريق"
    )
  }
}
