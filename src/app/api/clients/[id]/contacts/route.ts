import { z } from "zod"

import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { clientContactIdentity } from "@/lib/client-contact"
import {
  nullableClientContactText,
  requireClientAccount,
  syncClientPrimaryContact,
} from "@/lib/client-contact-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const createContactSchema = z.object({
  name: z.string().trim().min(2, "اسم جهة الاتصال مطلوب").max(160),
  jobTitle: z.string().trim().max(160).optional().or(z.literal("")),
  department: z.string().trim().max(160).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("البريد الإلكتروني غير صحيح")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  isPrimary: z.boolean().optional().default(false),
  isDecisionMaker: z.boolean().optional().default(false),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.clientManagement,
      "لا تملك صلاحية إضافة جهات اتصال للعملاء",
    )

    const { id: clientId } = await params
    const body = await readJsonBody(request)
    const parsed = createContactSchema.safeParse(body)

    if (!parsed.success) {
      return err("بيانات جهة الاتصال غير صحيحة", 400, parsed.error.flatten())
    }

    const data = parsed.data
    const identity = clientContactIdentity(data)
    const meta = await getRequestMeta()

    const contact = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Client"
        WHERE "id" = ${clientId}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const client = await requireClientAccount(
        tx,
        user.companyId,
        clientId,
      )

      const identityMatches = [
        ...(identity.emailNormalized
          ? [{ emailNormalized: identity.emailNormalized }]
          : []),
        ...(identity.phoneNormalized
          ? [{ phoneNormalized: identity.phoneNormalized }]
          : []),
        ...(identity.whatsappNormalized
          ? [{ whatsappNormalized: identity.whatsappNormalized }]
          : []),
      ]

      const duplicate =
        identityMatches.length > 0
          ? await tx.clientContact.findFirst({
              where: {
                companyId: user.companyId,
                clientId,
                archivedAt: null,
                name: {
                  equals: data.name,
                  mode: "insensitive",
                },
                OR: identityMatches,
              },
              select: {
                id: true,
              },
            })
          : null

      if (duplicate) {
        throw new ApiError(
          "توجد جهة اتصال نشطة بالاسم ووسيلة التواصل نفسها",
          409,
          "CLIENT_CONTACT_DUPLICATE",
        )
      }

      const currentPrimary = await tx.clientContact.findFirst({
        where: {
          companyId: user.companyId,
          clientId,
          isPrimary: true,
          archivedAt: null,
        },
        select: {
          id: true,
        },
      })
      const isPrimary = data.isPrimary || !currentPrimary

      if (isPrimary && currentPrimary) {
        await tx.clientContact.update({
          where: {
            id: currentPrimary.id,
          },
          data: {
            isPrimary: false,
          },
        })
      }

      const created = await tx.clientContact.create({
        data: {
          companyId: user.companyId,
          clientId,
          name: data.name,
          jobTitle: nullableClientContactText(data.jobTitle),
          department: nullableClientContactText(data.department),
          email: nullableClientContactText(data.email),
          phone: nullableClientContactText(data.phone),
          whatsapp: nullableClientContactText(data.whatsapp),
          isPrimary,
          isDecisionMaker: data.isDecisionMaker,
          notes: nullableClientContactText(data.notes),
          ...identity,
        },
      })

      if (isPrimary) {
        await syncClientPrimaryContact(tx, user.companyId, clientId)
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.CONTACT_CREATED,
        entityType: "ClientContact",
        entityId: created.id,
        message: `تمت إضافة جهة اتصال للعميل ${client.name}: ${created.name}`,
        metadata: {
          clientId,
          isPrimary,
          isDecisionMaker: created.isDecisionMaker,
        },
        ...meta,
      })

      if (isPrimary && currentPrimary) {
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.CONTACT_PRIMARY_CHANGED,
          entityType: "ClientContact",
          entityId: created.id,
          message: `تم تعيين جهة الاتصال الرئيسية للعميل ${client.name}: ${created.name}`,
          metadata: {
            clientId,
            previousPrimaryContactId: currentPrimary.id,
          },
          ...meta,
        })
      }

      return created
    })

    return ok({ contact }, 201)
  } catch (error) {
    return handleApiError(
      error,
      "CLIENT_CONTACT_POST_ERROR",
      "تعذر إضافة جهة الاتصال",
    )
  }
}
