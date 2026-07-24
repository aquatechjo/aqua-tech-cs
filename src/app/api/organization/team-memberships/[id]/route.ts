import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.organizationManagement,
      "لا تملك صلاحية إزالة الموظفين من الفرق"
    )

    const { id } = await params
    const membership = await prisma.teamMembership.findFirst({
      where: { id, companyId: user.companyId },
      select: {
        id: true,
        allocationPercent: true,
        team: { select: { name: true } },
        employeeProfile: {
          select: { user: { select: { name: true } } },
        },
      },
    })

    if (!membership) {
      return err("توزيع الموظف غير موجود", 404)
    }

    const meta = await getRequestMeta()
    await prisma.$transaction(async (tx) => {
      await tx.teamMembership.delete({ where: { id } })

      await logActivity({
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TEAM_MEMBERSHIP_REMOVED,
        entityType: "TeamMembership",
        entityId: id,
        message: `تمت إزالة ${membership.employeeProfile.user.name} من فريق ${membership.team.name}`,
        metadata: { allocationPercent: membership.allocationPercent },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })
    })

    return ok({ removed: true })
  } catch (error) {
    return handleApiError(
      error,
      "TEAM_MEMBERSHIPS_DELETE_ERROR",
      "حدث خطأ أثناء إزالة الموظف من الفريق"
    )
  }
}
