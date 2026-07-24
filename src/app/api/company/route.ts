import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { err, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

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
    return handleApiError(error, "COMPANY_GET_ERROR")
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()

    assertRole(
      user.role,
      ACCESS_ROLES.companySettings,
      "لا تملك صلاحية تعديل إعدادات الشركة"
    )

    const body = await readJsonBody(request)
    const parsed = updateCompanySchema.safeParse(body)

    if (!parsed.success) {
      return err("البيانات المدخلة غير صحيحة", 400, parsed.error.flatten())
    }

    const data = parsed.data
    const meta = await getRequestMeta()

    const company = await prisma.$transaction(async (tx) => {
      const updatedCompany = await tx.company.update({
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
        entityId: updatedCompany.id,
        message: "تم تعديل إعدادات الشركة",
        metadata: {
          name: updatedCompany.name,
          email: updatedCompany.email,
          website: updatedCompany.website,
          currency: updatedCompany.currency,
          timezone: updatedCompany.timezone,
          language: updatedCompany.language,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      return updatedCompany
    })

    return ok({ company })
  } catch (error) {
    return handleApiError(
      error,
      "COMPANY_PATCH_ERROR",
      "حدث خطأ أثناء تعديل إعدادات الشركة"
    )
  }
}
