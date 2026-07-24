import { z } from "zod"
import {
  AccessRole,
  ActivityAction,
  EmploymentType,
} from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { hashPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { SYSTEM_OWNER_EMAIL } from "@/lib/system-owner"

const updateUserSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب").optional(),
  email: z.string().email("البريد الإلكتروني غير صحيح").optional(),
  password: z
    .string()
    .min(12, "كلمة المرور يجب أن تكون 12 حرفًا على الأقل")
    .optional()
    .or(z.literal("")),
  role: z.nativeEnum(AccessRole).optional(),
  isActive: z.boolean().optional(),
  departmentId: z.string().trim().optional().nullable(),
  jobRoleId: z.string().trim().optional().nullable(),
  employeeNumber: z.string().trim().max(40).optional().or(z.literal("")),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  workHoursPerWeek: z.coerce.number().min(0).max(168).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request)

    const currentUser = await requireAuth()

    assertRole(
      currentUser.role,
      ACCESS_ROLES.teamManagement,
      "لا تملك صلاحية تعديل الموظفين"
    )

    const { id } = await params
    const body = await readJsonBody(request)
    const parsed = updateUserSchema.safeParse(body)

    if (!parsed.success) {
      return err("البيانات المدخلة غير صحيحة", 400, parsed.error.flatten())
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        companyId: currentUser.companyId,
      },
      include: {
        employeeProfile: {
          select: {
            id: true,
            departmentId: true,
            jobRoleId: true,
            employeeNumber: true,
            employmentType: true,
            workHoursPerWeek: true,
          },
        },
      },
    })

    if (!targetUser) {
      return err("المستخدم غير موجود", 404)
    }

    const data = parsed.data

    if (targetUser.role === "OWNER" && currentUser.role !== "OWNER") {
      throw new ApiError(
        "لا يمكن للمدير تعديل حساب OWNER",
        403,
        "OWNER_ACCOUNT_PROTECTED"
      )
    }

    if (targetUser.role === "OWNER") {
      const requestedEmail = data.email?.toLowerCase().trim()

      if (data.isActive === false) {
        throw new ApiError(
          "لا يمكن تعطيل حساب مالك النظام",
          403,
          "OWNER_ACCOUNT_PROTECTED"
        )
      }

      if (requestedEmail && requestedEmail !== SYSTEM_OWNER_EMAIL) {
        throw new ApiError(
          `بريد مالك النظام ثابت: ${SYSTEM_OWNER_EMAIL}`,
          403,
          "OWNER_EMAIL_PROTECTED"
        )
      }

      if (data.password?.trim()) {
        throw new ApiError(
          "يتم تغيير كلمة مرور مالك النظام من خلال مسار الاستعادة الآمن فقط",
          403,
          "OWNER_PASSWORD_PROTECTED"
        )
      }
    }

    if (data.role === "OWNER" && targetUser.role !== "OWNER") {
      throw new ApiError(
        "لا يمكن منح دور OWNER من لوحة الفريق",
        403,
        "OWNER_ROLE_PROTECTED"
      )
    }

    if (id === currentUser.id && data.isActive === false) {
      return err("لا يمكنك تعطيل حسابك الحالي", 400)
    }

    if (id === currentUser.id && data.role && data.role !== currentUser.role) {
      return err("لا يمكنك تغيير دور حسابك الحالي من هنا", 400)
    }

    if (targetUser.role === "OWNER" && data.role && data.role !== "OWNER") {
      throw new ApiError(
        "لا يمكن تغيير دور OWNER من لوحة الفريق",
        403,
        "OWNER_ROLE_PROTECTED"
      )
    }

    const updateData: {
      name?: string
      email?: string
      role?: AccessRole
      isActive?: boolean
      passwordHash?: string
    } = {}

    if (data.name) {
      updateData.name = data.name.trim()
    }

    if (data.email) {
      const normalizedEmail = data.email.toLowerCase().trim()

      const existingEmail = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          id: {
            not: id,
          },
        },
      })

      if (existingEmail) {
        return err("يوجد مستخدم آخر بهذا البريد الإلكتروني", 409)
      }

      updateData.email = normalizedEmail
    }

    if (data.role) {
      updateData.role = data.role
    }

    if (typeof data.isActive === "boolean") {
      updateData.isActive = data.isActive
    }

    if (data.password && data.password.trim().length > 0) {
      updateData.passwordHash = await hashPassword(data.password)
    }

    const requestedDepartmentId =
      data.departmentId === undefined
        ? targetUser.employeeProfile?.departmentId || null
        : data.departmentId || null
    const requestedJobRoleId =
      data.jobRoleId === undefined
        ? targetUser.employeeProfile?.jobRoleId || null
        : data.jobRoleId || null

    const [department, jobRole] = await Promise.all([
      requestedDepartmentId
        ? prisma.department.findFirst({
            where: {
              id: requestedDepartmentId,
              companyId: currentUser.companyId,
              isActive: true,
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      requestedJobRoleId
        ? prisma.jobRole.findFirst({
            where: {
              id: requestedJobRoleId,
              companyId: currentUser.companyId,
              isActive: true,
            },
            select: { id: true, departmentId: true },
          })
        : Promise.resolve(null),
    ])

    if (requestedDepartmentId && !department) {
      return err("القسم المحدد غير موجود أو غير فعّال", 400)
    }

    if (requestedJobRoleId && !jobRole) {
      return err("المسمى الوظيفي المحدد غير موجود أو غير فعّال", 400)
    }

    if (
      requestedDepartmentId &&
      jobRole?.departmentId &&
      requestedDepartmentId !== jobRole.departmentId
    ) {
      return err("المسمى الوظيفي لا يتبع للقسم المحدد", 400)
    }

    if (data.employeeNumber) {
      const duplicateEmployeeNumber = await prisma.employeeProfile.findFirst({
        where: {
          companyId: currentUser.companyId,
          employeeNumber: data.employeeNumber,
          userId: { not: id },
        },
        select: { id: true },
      })

      if (duplicateEmployeeNumber) {
        return err("الرقم الوظيفي مستخدم لموظف آخر", 409)
      }
    }

    const profileDepartmentId =
      requestedDepartmentId || jobRole?.departmentId || null
    const profileChanged = [
      "departmentId",
      "jobRoleId",
      "employeeNumber",
      "employmentType",
      "workHoursPerWeek",
    ].some((key) => key in data)

    const meta = await getRequestMeta()

    let action: ActivityAction = ActivityAction.USER_UPDATED
    let message = ""

    if (data.isActive === false) {
      action = ActivityAction.USER_DEACTIVATED
    }

    if (data.isActive === true) {
      action = ActivityAction.USER_ACTIVATED
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: {
          id,
        },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      })

      const employeeProfile = await tx.employeeProfile.upsert({
        where: { userId: id },
        create: {
          companyId: currentUser.companyId,
          userId: id,
          departmentId: profileDepartmentId,
          jobRoleId: requestedJobRoleId,
          employeeNumber: data.employeeNumber || null,
          employmentType: data.employmentType || "FULL_TIME",
          workHoursPerWeek: data.workHoursPerWeek,
          status: data.isActive === false ? "SUSPENDED" : "ACTIVE",
          startDate: targetUser.createdAt,
        },
        update: {
          departmentId: profileChanged ? profileDepartmentId : undefined,
          jobRoleId: profileChanged ? requestedJobRoleId : undefined,
          employeeNumber:
            data.employeeNumber === undefined
              ? undefined
              : data.employeeNumber || null,
          employmentType: data.employmentType,
          workHoursPerWeek: data.workHoursPerWeek,
          status:
            data.isActive === undefined
              ? undefined
              : data.isActive
                ? "ACTIVE"
                : "SUSPENDED",
        },
        include: {
          department: { select: { id: true, name: true, code: true } },
          jobRole: { select: { id: true, name: true, code: true } },
        },
      })

      if (data.isActive === false || updateData.passwordHash) {
        await tx.session.updateMany({
          where: {
            userId: id,
          },
          data: {
            isActive: false,
          },
        })
      }

      message =
        data.isActive === false
          ? `تم تعطيل حساب الموظف: ${result.name}`
          : data.isActive === true
            ? `تم تفعيل حساب الموظف: ${result.name}`
            : `تم تعديل بيانات الموظف: ${result.name}`

      await logActivity({
        companyId: currentUser.companyId,
        userId: currentUser.id,
        action,
        entityType: "User",
        entityId: result.id,
        message,
        metadata: {
          changedFields: Object.keys(updateData).filter(
            (key) => key !== "passwordHash"
          ),
          profileChangedFields: Object.keys(data).filter((key) =>
            [
              "departmentId",
              "jobRoleId",
              "employeeNumber",
              "employmentType",
              "workHoursPerWeek",
            ].includes(key)
          ),
          passwordChanged: Boolean(updateData.passwordHash),
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      return { ...result, employeeProfile }
    })

    return ok({ user: updatedUser })
  } catch (error) {
    return handleApiError(
      error,
      "TEAM_PATCH_ERROR",
      "حدث خطأ أثناء تعديل الموظف"
    )
  }
}
