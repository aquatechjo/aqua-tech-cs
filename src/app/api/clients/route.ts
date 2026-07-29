import { z } from "zod"
import {
  ActivityAction,
  ClientStatus,
  ClientType,
  LeadSource,
} from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { err, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { ensureClientContactFromSnapshot } from "@/lib/client-contact-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

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
  primaryContactName: z.string().trim().max(160).optional().or(z.literal("")),
})

function emptyToNull(value?: string) {
  if (!value || value.trim() === "") return null
  return value.trim()
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()

    assertRole(
      user.role,
      ACCESS_ROLES.clientManagement,
      "لا تملك صلاحية إضافة العملاء"
    )

    const body = await readJsonBody(request)
    const parsed = createClientSchema.safeParse(body)

    if (!parsed.success) {
      return err("البيانات المدخلة غير صحيحة", 400, parsed.error.flatten())
    }

    const data = parsed.data
    const meta = await getRequestMeta()

    const client = await prisma.$transaction(async (tx) => {
      const createdClient = await tx.client.create({
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
      const shouldCreatePrimaryContact =
        Boolean(data.primaryContactName?.trim()) ||
        Boolean(data.email?.trim()) ||
        Boolean(data.phone?.trim()) ||
        data.type === "INDIVIDUAL"
      const primaryContact = shouldCreatePrimaryContact
        ? await ensureClientContactFromSnapshot({
            db: tx,
            companyId: user.companyId,
            clientId: createdClient.id,
            name: data.primaryContactName?.trim() || createdClient.name,
            email: data.email,
            phone: data.phone,
          })
        : null

      await logActivity({
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.CLIENT_CREATED,
        entityType: "Client",
        entityId: createdClient.id,
        message: `تم إضافة عميل جديد: ${createdClient.name}`,
        metadata: {
          type: createdClient.type,
          status: createdClient.status,
          source: createdClient.source,
          primaryContactId: primaryContact?.contact.id ?? null,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      if (primaryContact?.created) {
        await logActivity({
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.CONTACT_CREATED,
          entityType: "ClientContact",
          entityId: primaryContact.contact.id,
          message: `تمت إضافة جهة الاتصال الرئيسية للعميل ${createdClient.name}: ${primaryContact.contact.name}`,
          metadata: {
            clientId: createdClient.id,
            isPrimary: primaryContact.contact.isPrimary,
          },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          db: tx,
        })
      }

      return createdClient
    })

    return ok({ client }, 201)
  } catch (error) {
    return handleApiError(
      error,
      "CLIENT_POST_ERROR",
      "حدث خطأ أثناء إضافة العميل"
    )
  }
}
