import { z } from "zod"
import {
  ActivityAction,
  ClientStatus,
  ClientType,
  LeadSource,
} from "@/generated/prisma/enums"
import { err, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"

const createClientSchema = z.object({
  name: z.string().min(2, "اسم العميل مطلوب"),
  email: z.string().email("البريد الإلكتروني غير صحيح").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  website: z.string().url("رابط الموقع غير صحيح").optional().or(z.literal("")),
  type: z.nativeEnum(ClientType),
  status: z.nativeEnum(ClientStatus),
  source: z.nativeEnum(LeadSource),
  industry: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
})

function emptyToNull(value?: string) {
  if (!value || value.trim() === "") return null
  return value.trim()
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const parsed = createClientSchema.safeParse(body)

    if (!parsed.success) {
      return err("البيانات المدخلة غير صحيحة", 400, parsed.error.flatten())
    }

    const data = parsed.data
    const meta = await getRequestMeta()

    const client = await prisma.client.create({
      data: {
        companyId: user.companyId,
        name: data.name.trim(),
        email: emptyToNull(data.email),
        phone: emptyToNull(data.phone),
        website: emptyToNull(data.website),
        type: data.type,
        status: data.status,
        source: data.source,
        industry: emptyToNull(data.industry),
        country: emptyToNull(data.country),
        city: emptyToNull(data.city),
        notes: emptyToNull(data.notes),
      },
    })

    await logActivity({
      companyId: user.companyId,
      userId: user.id,
      action: ActivityAction.CLIENT_CREATED,
      entityType: "Client",
      entityId: client.id,
      message: `تم إضافة عميل جديد: ${client.name}`,
      metadata: {
        type: client.type,
        status: client.status,
        source: client.source,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return ok({ client }, 201)
  } catch (error) {
    console.error("[CLIENT_POST_ERROR]", error)
    return err("حدث خطأ أثناء إضافة العميل", 500)
  }
}