import { z } from "zod"
import {
  AccessRole,
  ActivityAction,
  EmploymentType,
} from "@/generated/prisma/enums"
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
  role: z.nativeEnum(AccessRole).refine((role) => role !== "OWNER", {
    message: "لا يمكن إنشاء حساب OWNER من لوحة الفريق",
  }),
  departmentId: z.string().trim().optional().nullable(),
  jobRoleId: z.string().trim().optional().nullable(),
  employeeNumber: z.string().trim().max(40).optional().or(z.literal("")),
  employmentType: z.nativeEnum(EmploymentType).default("FULL_TIME"),
  workHoursPerWeek: z.coerce.number().min(0).max(168).default(40),
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
        employeeProfile: {
          include: {
            department: { select: { id: true, name: true, code: true } },
            jobRole: { select: { id: true, name: true, code: true } },
          },
        },
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

    const {
      name,
      email,
      password,
      role,
      departmentId: requestedDepartmentId,
      jobRoleId,
      employeeNumber,
      employmentType,
      workHoursPerWeek,
    } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    })

    if (existingUser) {
      return err("يوجد مستخدم بهذا البريد الإلكتروني", 409)
    }

    const [department, jobRole, duplicateEmployeeNumber] = await Promise.all([
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
      jobRoleId
        ? prisma.jobRole.findFirst({
            where: {
              id: jobRoleId,
              companyId: currentUser.companyId,
              isActive: true,
            },
            select: { id: true, departmentId: true },
          })
        : Promise.resolve(null),
      employeeNumber
        ? prisma.employeeProfile.findFirst({
            where: {
              companyId: currentUser.companyId,
              employeeNumber,
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ])

    if (requestedDepartmentId && !department) {
      return err("القسم المحدد غير موجود أو غير فعّال", 400)
    }

    if (jobRoleId && !jobRole) {
      return err("المسمى الوظيفي المحدد غير موجود أو غير فعّال", 400)
    }

    if (duplicateEmployeeNumber) {
      return err("الرقم الوظيفي مستخدم لموظف آخر", 409)
    }

    const departmentId = requestedDepartmentId || jobRole?.departmentId || null

    if (
      requestedDepartmentId &&
      jobRole?.departmentId &&
      requestedDepartmentId !== jobRole.departmentId
    ) {
      return err("المسمى الوظيفي لا يتبع للقسم المحدد", 400)
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

      const employeeProfile = await tx.employeeProfile.create({
        data: {
          companyId: currentUser.companyId,
          userId: createdUser.id,
          departmentId,
          jobRoleId: jobRoleId || null,
          employeeNumber: employeeNumber || null,
          employmentType,
          workHoursPerWeek,
          status: "ACTIVE",
          startDate: new Date(),
        },
        include: {
          department: { select: { id: true, name: true, code: true } },
          jobRole: { select: { id: true, name: true, code: true } },
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
          accessRole: createdUser.role,
          departmentId,
          jobRoleId: jobRoleId || null,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      return { ...createdUser, employeeProfile }
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
