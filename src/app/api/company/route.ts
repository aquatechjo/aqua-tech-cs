import { z } from "zod"
import { ActivityAction, UserRole } from "@/generated/prisma/enums"
import { err, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"

const updateCompanySchema = z.object({
  name: z.string().min(2, "اسم الشركة مطلوب"),
  email: z.string().email("البريد الإلكتروني غير صحيح").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  website: z.string().url("رابط الموقع غير صحيح").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  country: z.string().min(2, "الدولة مطلوبة"),
  currency: z.string().min(2).max(5),
  timezone: z.string().min(2),
  language: z.string().min(2).max(5),
})

function canManageSettings(role: UserRole) {
  return role === "OWNER" || role === "ADMIN"
}

function emptyToNull(value?: string) {
  if (!value || value.trim() === "") return null
  return value.trim()
}

export async function GET() {
  try {
    const user = await requireAuth()

    const company = await prisma.company.findUnique({
      where: {
        id: user.companyId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        website: true,
        logoUrl: true,
        address: true,
        country: true,
        currency: true,
        timezone: true,
        language: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!company) {
      return err("الشركة غير موجودة", 404)
    }

    return ok({ company })
  } catch (error) {
    console.error("[COMPANY_GET_ERROR]", error)
    return err("غير مصرح", 401)
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth()

    if (!canManageSettings(user.role)) {
      return err("لا تملك صلاحية تعديل إعدادات الشركة", 403)
    }

    const body = await request.json()
    const parsed = updateCompanySchema.safeParse(body)

    if (!parsed.success) {
      return err("البيانات المدخلة غير صحيحة", 400, parsed.error.flatten())
    }

    const data = parsed.data
    const meta = await getRequestMeta()

    const company = await prisma.company.update({
      where: {
        id: user.companyId,
      },
      data: {
        name: data.name.trim(),
        email: emptyToNull(data.email),
        phone: emptyToNull(data.phone),
        website: emptyToNull(data.website),
        address: emptyToNull(data.address),
        country: data.country.trim(),
        currency: data.currency.trim().toUpperCase(),
        timezone: data.timezone.trim(),
        language: data.language.trim(),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        website: true,
        logoUrl: true,
        address: true,
        country: true,
        currency: true,
        timezone: true,
        language: true,
        updatedAt: true,
      },
    })

    await logActivity({
      companyId: user.companyId,
      userId: user.id,
      action: ActivityAction.COMPANY_UPDATED,
      entityType: "Company",
      entityId: company.id,
      message: "تم تعديل إعدادات الشركة",
      metadata: {
        name: company.name,
        email: company.email,
        website: company.website,
        currency: company.currency,
        timezone: company.timezone,
        language: company.language,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return ok({ company })
  } catch (error) {
    console.error("[COMPANY_PATCH_ERROR]", error)
    return err("حدث خطأ أثناء تعديل إعدادات الشركة", 500)
  }
}