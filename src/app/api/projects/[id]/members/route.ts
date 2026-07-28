import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { assertCanManageProjectLeadership } from "@/lib/access-control"
import { err, ok, withApiHandler } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { canAssignTaskTo } from "@/lib/task-scope"
import { resolveTaskAccessScope } from "@/lib/task-scope-server"

const memberSchema = z.object({
  employeeProfileId: z.string().min(1),
  role: z
    .enum(["PROJECT_LEAD", "MANAGER", "CONTRIBUTOR", "VIEWER"])
    .optional(),
  responsibility: z.string().trim().max(500).optional().nullable(),
})

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function addProjectMember(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: projectId } = await context.params
  const [project, scope] = await Promise.all([
    requireProjectExecutionManager(user, projectId),
    resolveTaskAccessScope(user),
  ])
  const body = await readJsonBody(request)
  const parsed = memberSchema.safeParse(body)

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "بيانات عضو المشروع غير صحيحة", 400, {
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    })
  }

  const employee = await prisma.employeeProfile.findFirst({
    where: {
      id: parsed.data.employeeProfileId,
      companyId: user.companyId,
      status: "ACTIVE",
      user: {
        isActive: true,
      },
    },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!employee) {
    return err("الموظف غير موجود أو غير فعال", 404, {
      code: "EMPLOYEE_NOT_FOUND",
    })
  }

  if (!canAssignTaskTo(scope, employee.userId)) {
    return err(
      "لا يمكنك إضافة موظف خارج نطاق عملك إلى المشروع",
      403,
      {
        code: "PROJECT_MEMBER_SCOPE_FORBIDDEN",
      }
    )
  }

  const existing = await prisma.projectMember.findUnique({
    where: {
      projectId_employeeProfileId: {
        projectId,
        employeeProfileId: employee.id,
      },
    },
    select: {
      id: true,
      role: true,
    },
  })

  const nextRole = parsed.data.role ?? existing?.role ?? "CONTRIBUTOR"
  const currentProjectRole = project.members[0]?.role

  const isLeadershipRole = (role: string) =>
    role === "PROJECT_LEAD" || role === "MANAGER"
  const changesLeadershipRole =
    (isLeadershipRole(nextRole) && existing?.role !== nextRole) ||
    (existing?.role !== undefined &&
      isLeadershipRole(existing.role) &&
      nextRole !== existing.role)

  if (changesLeadershipRole) {
    assertCanManageProjectLeadership(user, currentProjectRole)
  }

  if (existing?.role === "PROJECT_LEAD" && nextRole !== "PROJECT_LEAD") {
    return err("عيّن قائدًا جديدًا بدلًا منه قبل تغيير دور قائد المشروع الحالي", 409, {
      code: "PROJECT_LEAD_REPLACEMENT_REQUIRED",
    })
  }

  const member = await prisma.$transaction(async (tx) => {
    if (nextRole === "PROJECT_LEAD") {
      await tx.projectMember.updateMany({
        where: {
          projectId,
          role: "PROJECT_LEAD",
          employeeProfileId: {
            not: employee.id,
          },
        },
        data: {
          role: "MANAGER",
        },
      })
    }

    const savedMember = await tx.projectMember.upsert({
      where: {
        projectId_employeeProfileId: {
          projectId,
          employeeProfileId: employee.id,
        },
      },
      create: {
        companyId: user.companyId,
        projectId,
        employeeProfileId: employee.id,
        role: nextRole,
        responsibility: nullableText(parsed.data.responsibility),
      },
      update: {
        role: nextRole,
        ...(parsed.data.responsibility !== undefined
          ? { responsibility: nullableText(parsed.data.responsibility) }
          : {}),
      },
      include: {
        employeeProfile: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: existing
          ? ActivityAction.PROJECT_MEMBER_UPDATED
          : ActivityAction.PROJECT_MEMBER_ADDED,
        entityType: "ProjectMember",
        entityId: savedMember.id,
        message: existing
          ? `تم تحديث دور ${employee.user.name} في مشروع ${project.name}`
          : `تمت إضافة ${employee.user.name} إلى مشروع ${project.name}`,
        metadata: {
          projectId,
          employeeProfileId: employee.id,
          role: savedMember.role,
        },
      },
    })

    return savedMember
  })

  return ok({ member }, existing ? 200 : 201)
}

export const POST = withApiHandler(
  "PROJECT_MEMBER_POST_ERROR",
  addProjectMember,
  "حدث خطأ أثناء حفظ عضو المشروع"
)
