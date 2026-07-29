import { z } from "zod"

import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { clientContactIdentity } from "@/lib/client-contact"
import {
  chooseReplacementPrimaryContact,
  makePrimaryClientContact,
  nullableClientContactText,
  requireClientAccount,
  syncClientPrimaryContact,
} from "@/lib/client-contact-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const updateContactSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
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
    isPrimary: z.literal(true).optional(),
    isDecisionMaker: z.boolean().optional(),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
    archived: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "لا توجد تغييرات للحفظ",
  })

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; contactId: string }>
  },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.clientManagement,
      "لا تملك صلاحية تعديل جهات اتصال العملاء",
    )

    const { id: clientId, contactId } = await params
    const body = await readJsonBody(request)
    const parsed = updateContactSchema.safeParse(body)

    if (!parsed.success) {
      return err("بيانات جهة الاتصال غير صحيحة", 400, parsed.error.flatten())
    }

    const data = parsed.data
    const meta = await getRequestMeta()

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "ClientContact"
        WHERE "id" = ${contactId}
          AND "clientId" = ${clientId}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const client = await requireClientAccount(
        tx,
        user.companyId,
        clientId,
      )
      const existing = await tx.clientContact.findFirst({
        where: {
          id: contactId,
          clientId,
          companyId: user.companyId,
        },
      })

      if (!existing) {
        throw new ApiError(
          "جهة الاتصال غير موجودة",
          404,
          "CLIENT_CONTACT_NOT_FOUND",
        )
      }

      if (data.archived === true) {
        if (existing.archivedAt) {
          return {
            contact: existing,
            replayed: true,
          }
        }

        const archived = await tx.clientContact.update({
          where: {
            id: existing.id,
          },
          data: {
            archivedAt: new Date(),
            isPrimary: false,
          },
        })

        if (existing.isPrimary) {
          await chooseReplacementPrimaryContact(
            tx,
            user.companyId,
            clientId,
            existing.id,
          )
        }

        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.CONTACT_ARCHIVED,
          entityType: "ClientContact",
          entityId: archived.id,
          message: `تمت أرشفة جهة اتصال العميل ${client.name}: ${archived.name}`,
          metadata: {
            clientId,
            wasPrimary: existing.isPrimary,
          },
          ...meta,
        })

        return {
          contact: archived,
          replayed: false,
        }
      }

      if (data.archived === false && existing.archivedAt) {
        let restored = await tx.clientContact.update({
          where: {
            id: existing.id,
          },
          data: {
            archivedAt: null,
          },
        })
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

        if (!currentPrimary || data.isPrimary) {
          restored = await makePrimaryClientContact(
            tx,
            user.companyId,
            clientId,
            restored.id,
          )
        }

        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.CONTACT_RESTORED,
          entityType: "ClientContact",
          entityId: restored.id,
          message: `تمت استعادة جهة اتصال العميل ${client.name}: ${restored.name}`,
          metadata: {
            clientId,
            isPrimary: restored.isPrimary,
          },
          ...meta,
        })

        return {
          contact: restored,
          replayed: false,
        }
      }

      if (existing.archivedAt) {
        throw new ApiError(
          "استعد جهة الاتصال قبل تعديل بياناتها",
          409,
          "CLIENT_CONTACT_ARCHIVED",
        )
      }

      const identity = clientContactIdentity({
        email:
          data.email === undefined
            ? existing.email
            : nullableClientContactText(data.email),
        phone:
          data.phone === undefined
            ? existing.phone
            : nullableClientContactText(data.phone),
        whatsapp:
          data.whatsapp === undefined
            ? existing.whatsapp
            : nullableClientContactText(data.whatsapp),
      })
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
                id: {
                  not: existing.id,
                },
                archivedAt: null,
                name: {
                  equals: data.name ?? existing.name,
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

      const previousPrimary =
        data.isPrimary === true && !existing.isPrimary
          ? await tx.clientContact.findFirst({
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
          : null

      let contact = await tx.clientContact.update({
        where: {
          id: existing.id,
        },
        data: {
          name: data.name,
          jobTitle:
            data.jobTitle === undefined
              ? undefined
              : nullableClientContactText(data.jobTitle),
          department:
            data.department === undefined
              ? undefined
              : nullableClientContactText(data.department),
          email:
            data.email === undefined
              ? undefined
              : nullableClientContactText(data.email),
          phone:
            data.phone === undefined
              ? undefined
              : nullableClientContactText(data.phone),
          whatsapp:
            data.whatsapp === undefined
              ? undefined
              : nullableClientContactText(data.whatsapp),
          isDecisionMaker: data.isDecisionMaker,
          notes:
            data.notes === undefined
              ? undefined
              : nullableClientContactText(data.notes),
          ...identity,
        },
      })

      const primaryChanged = data.isPrimary === true && !existing.isPrimary

      if (data.isPrimary) {
        contact = await makePrimaryClientContact(
          tx,
          user.companyId,
          clientId,
          contact.id,
        )
      } else if (existing.isPrimary) {
        await syncClientPrimaryContact(tx, user.companyId, clientId)
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.CONTACT_UPDATED,
        entityType: "ClientContact",
        entityId: contact.id,
        message: `تم تعديل جهة اتصال العميل ${client.name}: ${contact.name}`,
        metadata: {
          clientId,
          isPrimary: contact.isPrimary,
          isDecisionMaker: contact.isDecisionMaker,
        },
        ...meta,
      })

      if (primaryChanged) {
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.CONTACT_PRIMARY_CHANGED,
          entityType: "ClientContact",
          entityId: contact.id,
          message: `تم تعيين جهة الاتصال الرئيسية للعميل ${client.name}: ${contact.name}`,
          metadata: {
            clientId,
            previousPrimaryContactId: previousPrimary?.id ?? null,
          },
          ...meta,
        })
      }

      return {
        contact,
        replayed: false,
      }
    })

    return ok(result)
  } catch (error) {
    return handleApiError(
      error,
      "CLIENT_CONTACT_PATCH_ERROR",
      "تعذر تعديل جهة الاتصال",
    )
  }
}
