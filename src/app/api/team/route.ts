import { z } from "zod"
import { ActivityAction, UserRole } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { err, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { hashPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const createUserSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(12, "كلمة المرور يجب أن تكون 12 حرفًا على الأقل"),
  role: z.nativeEnum(UserRole).refine((role) => role !== "OWNER", {
    message: "لا يمكن إنشاء حساب OWNER من لوحة الفريق",
  }),
})

export async function GET() {
  try {
    const user = await requireAuth()

    const users = await prisma.user.findMany({
      where: {
        companyId: user.companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
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

    return ok({ users })
  } catch (error) {
    return handleApiError(error, "TEAM_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)

    const currentUser = await requireAuth()

    assertRole(
      currentUser.role,
      ACCESS_ROLES.teamManagement,
      "لا تملك صلاحية إضافة موظفين"
    )

    const body = await readJsonBody(request)
    const parsed = createUserSchema.safeParse(body)

    if (!parsed.success) {
      return err("البيانات المدخلة غير صحيحة", 400, parsed.error.flatten())
    }

    const { name, email, password, role } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    })

    if (existingUser) {
      return err("يوجد مستخدم بهذا البريد الإلكتروني", 409)
    }

    const passwordHash = await hashPassword(password)
    const meta = await getRequestMeta()

    const newUser = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          companyId: currentUser.companyId,
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          role,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      })

      await logActivity({
        companyId: currentUser.companyId,
        userId: currentUser.id,
        action: ActivityAction.USER_CREATED,
        entityType: "User",
        entityId: createdUser.id,
        message: `تم إضافة موظف جديد: ${createdUser.name}`,
        metadata: {
          email: createdUser.email,
          role: createdUser.role,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      return createdUser
    })

    return ok({ user: newUser }, 201)
  } catch (error) {
    return handleApiError(
      error,
      "TEAM_POST_ERROR",
      "حدث خطأ أثناء إضافة الموظف"
    )
  }
}
