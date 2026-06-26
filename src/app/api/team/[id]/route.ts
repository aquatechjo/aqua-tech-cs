import { z } from "zod"
import { ActivityAction, UserRole } from "@/generated/prisma/enums"
import { err, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { hashPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"

const updateUserSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب").optional(),
  email: z.string().email("البريد الإلكتروني غير صحيح").optional(),
  password: z
    .string()
    .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    .optional()
    .or(z.literal("")),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
})

function canManageTeam(role: UserRole) {
  return role === "OWNER" || role === "ADMIN"
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuth()

    if (!canManageTeam(currentUser.role)) {
      return err("لا تملك صلاحية تعديل الموظفين", 403)
    }

    const { id } = await params
    const body = await request.json()
    const parsed = updateUserSchema.safeParse(body)

    if (!parsed.success) {
      return err("البيانات المدخلة غير صحيحة", 400, parsed.error.flatten())
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        companyId: currentUser.companyId,
      },
    })

    if (!targetUser) {
      return err("المستخدم غير موجود", 404)
    }

    const data = parsed.data

    if (id === currentUser.id && data.isActive === false) {
      return err("لا يمكنك تعطيل حسابك الحالي", 400)
    }

    if (id === currentUser.id && data.role && data.role !== currentUser.role) {
      return err("لا يمكنك تغيير دور حسابك الحالي من هنا", 400)
    }

    if (targetUser.role === "OWNER" && data.role && data.role !== "OWNER") {
      const ownersCount = await prisma.user.count({
        where: {
          companyId: currentUser.companyId,
          role: "OWNER",
          isActive: true,
        },
      })

      if (ownersCount <= 1) {
        return err("لا يمكن تغيير دور آخر OWNER نشط في النظام", 400)
      }
    }

    const updateData: {
      name?: string
      email?: string
      role?: UserRole
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

    const updatedUser = await prisma.user.update({
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

    if (data.isActive === false || updateData.passwordHash) {
      await prisma.session.updateMany({
        where: {
          userId: id,
        },
        data: {
          isActive: false,
        },
      })
    }

    const meta = await getRequestMeta()

    let action: ActivityAction = ActivityAction.USER_UPDATED
    let message = `تم تعديل بيانات الموظف: ${updatedUser.name}`

    if (data.isActive === false) {
      action = ActivityAction.USER_DEACTIVATED
      message = `تم تعطيل حساب الموظف: ${updatedUser.name}`
    }

    if (data.isActive === true) {
      action = ActivityAction.USER_ACTIVATED
      message = `تم تفعيل حساب الموظف: ${updatedUser.name}`
    }

    await logActivity({
      companyId: currentUser.companyId,
      userId: currentUser.id,
      action,
      entityType: "User",
      entityId: updatedUser.id,
      message,
      metadata: {
        changedFields: Object.keys(updateData).filter(
          (key) => key !== "passwordHash"
        ),
        passwordChanged: Boolean(updateData.passwordHash),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return ok({ user: updatedUser })
  } catch (error) {
    console.error("[TEAM_PATCH_ERROR]", error)
    return err("حدث خطأ أثناء تعديل الموظف", 500)
  }
}