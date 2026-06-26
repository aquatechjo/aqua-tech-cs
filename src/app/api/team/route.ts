import { z } from "zod"
import { ActivityAction, UserRole } from "@/generated/prisma/enums"
import { err, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { hashPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"

const createUserSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  role: z.nativeEnum(UserRole),
})

function canManageTeam(role: UserRole) {
  return role === "OWNER" || role === "ADMIN"
}

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
    console.error("[TEAM_GET_ERROR]", error)
    return err("غير مصرح", 401)
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth()

    if (!canManageTeam(currentUser.role)) {
      return err("لا تملك صلاحية إضافة موظفين", 403)
    }

    const body = await request.json()
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

    const newUser = await prisma.user.create({
      data: {
        companyId: currentUser.companyId,
        name,
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
      entityId: newUser.id,
      message: `تم إضافة موظف جديد: ${newUser.name}`,
      metadata: {
        email: newUser.email,
        role: newUser.role,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return ok({ user: newUser }, 201)
  } catch (error) {
    console.error("[TEAM_POST_ERROR]", error)
    return err("حدث خطأ أثناء إضافة الموظف", 500)
  }
}