import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { assertAllocationCapacity } from "@/lib/organization"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const membershipSchema = z.object({
  teamId: z.string().trim().min(1, "الفريق مطلوب"),
  employeeProfileId: z.string().trim().min(1, "الموظف مطلوب"),
  allocationPercent: z.coerce.number().int().min(1).max(100),
  responsibility: z.string().trim().max(120).optional().or(z.literal("")),
})

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.organizationManagement,
      "لا تملك صلاحية توزيع الموظفين على الفرق"
    )

    const parsed = membershipSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      return err("بيانات توزيع الموظف غير صحيحة", 400, parsed.error.flatten())
    }

    const { teamId, employeeProfileId, allocationPercent } = parsed.data
    const [team, employeeProfile] = await Promise.all([
      prisma.team.findFirst({
        where: { id: teamId, companyId: user.companyId, isActive: true },
        select: { id: true, name: true },
      }),
      prisma.employeeProfile.findFirst({
        where: { id: employeeProfileId, companyId: user.companyId },
        select: {
          id: true,
          user: { select: { name: true } },
        },
      }),
    ])

    if (!team) {
      return err("الفريق المحدد غير موجود أو غير فعّال", 400)
    }

    if (!employeeProfile) {
      return err("الموظف المحدد غير موجود", 400)
    }

    const meta = await getRequestMeta()
    const membership = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "EmployeeProfile"
        WHERE "id" = ${employeeProfileId}
        FOR UPDATE
      `

      const existing = await tx.teamMembership.findUnique({
        where: {
          teamId_employeeProfileId: { teamId, employeeProfileId },
        },
        select: { id: true },
      })

      const otherAllocations = await tx.teamMembership.findMany({
        where: {
          employeeProfileId,
          ...(existing ? { id: { not: existing.id } } : {}),
        },
        select: { allocationPercent: true },
      })

      assertAllocationCapacity(
        otherAllocations.map((item) => item.allocationPercent),
        allocationPercent
      )

      const saved = await tx.teamMembership.upsert({
        where: {
          teamId_employeeProfileId: { teamId, employeeProfileId },
        },
        create: {
          companyId: user.companyId,
          teamId,
          employeeProfileId,
          allocationPercent,
          responsibility: parsed.data.responsibility || null,
        },
        update: {
          allocationPercent,
          responsibility: parsed.data.responsibility || null,
        },
      })

      await logActivity({
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TEAM_MEMBERSHIP_UPDATED,
        entityType: "TeamMembership",
        entityId: saved.id,
        message: `تم توزيع ${employeeProfile.user.name} على فريق ${team.name} بنسبة ${allocationPercent}%`,
        metadata: { teamId, employeeProfileId, allocationPercent },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      return saved
    })

    return ok({ membership })
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.code === "ALLOCATION_EXCEEDS_CAPACITY"
    ) {
      return handleApiError(error, "TEAM_MEMBERSHIP_CAPACITY_ERROR")
    }

    return handleApiError(
      error,
      "TEAM_MEMBERSHIPS_POST_ERROR",
      "حدث خطأ أثناء توزيع الموظف على الفريق"
    )
  }
}
