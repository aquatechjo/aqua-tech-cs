import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { assertCanManageProjectLeadership } from "@/lib/access-control"
import { err, ok, withApiHandler } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const updateMemberSchema = z.object({
  role: z.enum(["PROJECT_LEAD", "MANAGER", "CONTRIBUTOR", "VIEWER"]).optional(),
  responsibility: z.string().trim().max(500).optional().nullable(),
})

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function updateProjectMember(
  request: Request,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: projectId, memberId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const body = await readJsonBody(request)
  const parsed = updateMemberSchema.safeParse(body)

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "بيانات عضو المشروع غير صحيحة", 400, {
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    })
  }

  const existing = await prisma.projectMember.findFirst({
    where: {
      id: memberId,
      projectId,
      companyId: user.companyId,
    },
    include: {
      employeeProfile: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  if (!existing) {
    return err("عضو المشروع غير موجود", 404, {
      code: "PROJECT_MEMBER_NOT_FOUND",
    })
  }

  const currentProjectRole = project.members[0]?.role
  const nextRole = parsed.data.role ?? existing.role
  const isLeadershipRole = (role: string) =>
    role === "PROJECT_LEAD" || role === "MANAGER"
  const changesLeadershipRole =
    (isLeadershipRole(nextRole) && existing.role !== nextRole) ||
    (isLeadershipRole(existing.role) && nextRole !== existing.role)

  if (changesLeadershipRole) {
    assertCanManageProjectLeadership(user, currentProjectRole)
  }

  if (existing.role === "PROJECT_LEAD" && nextRole !== "PROJECT_LEAD") {
    return err("عيّن قائدًا جديدًا بدلًا منه قبل تغيير دور قائد المشروع الحالي", 409, {
      code: "PROJECT_LEAD_REPLACEMENT_REQUIRED",
    })
  }

  const member = await prisma.$transaction(async (tx) => {
    if (parsed.data.role === "PROJECT_LEAD") {
      await tx.projectMember.updateMany({
        where: {
          projectId,
          role: "PROJECT_LEAD",
          id: {
            not: memberId,
          },
        },
        data: {
          role: "MANAGER",
        },
      })
    }

    const updated = await tx.projectMember.update({
      where: {
        id: memberId,
      },
      data: {
        ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
        ...(parsed.data.responsibility !== undefined
          ? { responsibility: nullableText(parsed.data.responsibility) }
          : {}),
      },
    })

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PROJECT_MEMBER_UPDATED,
        entityType: "ProjectMember",
        entityId: updated.id,
        message: `تم تحديث دور ${existing.employeeProfile.user.name} في مشروع ${project.name}`,
        metadata: {
          projectId,
          role: updated.role,
        },
      },
    })

    return updated
  })

  return ok({ member })
}

async function removeProjectMember(
  request: Request,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: projectId, memberId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)

  const existing = await prisma.projectMember.findFirst({
    where: {
      id: memberId,
      projectId,
      companyId: user.companyId,
    },
    include: {
      employeeProfile: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  if (!existing) {
    return err("عضو المشروع غير موجود", 404, {
      code: "PROJECT_MEMBER_NOT_FOUND",
    })
  }

  if (existing.role === "PROJECT_LEAD") {
    assertCanManageProjectLeadership(user, project.members[0]?.role)
    return err("عيّن قائدًا جديدًا قبل إزالة قائد المشروع الحالي", 409, {
      code: "PROJECT_LEAD_REPLACEMENT_REQUIRED",
    })
  }

  if (existing.role === "MANAGER") {
    assertCanManageProjectLeadership(user, project.members[0]?.role)
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectMember.delete({
      where: {
        id: existing.id,
      },
    })

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PROJECT_MEMBER_REMOVED,
        entityType: "ProjectMember",
        entityId: existing.id,
        message: `تمت إزالة ${existing.employeeProfile.user.name} من مشروع ${project.name}`,
        metadata: {
          projectId,
          employeeProfileId: existing.employeeProfileId,
        },
      },
    })
  })

  return ok({ deleted: true })
}

export const PATCH = withApiHandler(
  "PROJECT_MEMBER_PATCH_ERROR",
  updateProjectMember,
  "حدث خطأ أثناء تعديل عضو المشروع"
)
export const DELETE = withApiHandler(
  "PROJECT_MEMBER_DELETE_ERROR",
  removeProjectMember,
  "حدث خطأ أثناء إزالة عضو المشروع"
)
