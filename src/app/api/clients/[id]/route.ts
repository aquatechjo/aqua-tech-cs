import { z } from "zod";
import {
  ActivityAction,
  ClientStatus,
  ClientType,
  LeadSource,
} from "@/generated/prisma/enums";
import { ACCESS_ROLES, assertRole } from "@/lib/access-control";
import { err, handleApiError, ok } from "@/lib/api-response";
import { getRequestMeta, requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { clientContactIdentity } from "@/lib/client-contact";
import {
  ensureClientContactFromSnapshot,
  nullableClientContactText,
  syncClientPrimaryContact,
} from "@/lib/client-contact-server";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, readJsonBody } from "@/lib/request-security";

const updateClientSchema = z.object({
  name: z.string().min(2, "اسم العميل مطلوب").optional(),
  email: z
    .string()
    .email("البريد الإلكتروني غير صحيح")
    .optional()
    .or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  website: z.string().url("رابط الموقع غير صحيح").optional().or(z.literal("")),
  type: z.nativeEnum(ClientType).optional(),
  status: z.nativeEnum(ClientStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  industry: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

function emptyToNull(value?: string) {
  if (value === undefined) return undefined;
  if (!value || value.trim() === "") return null;
  return value.trim();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);

    const user = await requireAuth();

    assertRole(
      user.role,
      ACCESS_ROLES.clientManagement,
      "لا تملك صلاحية تعديل العملاء",
    );

    const { id } = await params;
    const body = await readJsonBody(request);
    const parsed = updateClientSchema.safeParse(body);

    if (!parsed.success) {
      return err("البيانات المدخلة غير صحيحة", 400, parsed.error.flatten());
    }

    const existingClient = await prisma.client.findFirst({
      where: {
        id,
        companyId: user.companyId,
      },
    });

    if (!existingClient) {
      return err("العميل غير موجود", 404);
    }

    const data = parsed.data;
    const meta = await getRequestMeta();

    let action: ActivityAction = ActivityAction.CLIENT_UPDATED;

    if (data.status === "ARCHIVED") {
      action = ActivityAction.CLIENT_ARCHIVED;
    }

    if (
      existingClient.status === "ARCHIVED" &&
      data.status &&
      data.status !== "ARCHIVED"
    ) {
      action = ActivityAction.CLIENT_RESTORED;
    }

    const client = await prisma.$transaction(async (tx) => {
      const updatedClient = await tx.client.update({
        where: { id },
        data: {
          name: data.name?.trim(),
          email:
            data.email === undefined ? undefined : emptyToNull(data.email),
          phone:
            data.phone === undefined ? undefined : emptyToNull(data.phone),
          website: emptyToNull(data.website),
          type: data.type,
          status: data.status,
          source: data.source,
          industry: emptyToNull(data.industry),
          country: emptyToNull(data.country),
          city: emptyToNull(data.city),
          notes: emptyToNull(data.notes),
        },
      });

      if (data.email !== undefined || data.phone !== undefined) {
        const primaryContact = await tx.clientContact.findFirst({
          where: {
            companyId: user.companyId,
            clientId: updatedClient.id,
            isPrimary: true,
            archivedAt: null,
          },
        });

        if (primaryContact) {
          const email =
            data.email === undefined
              ? primaryContact.email
              : nullableClientContactText(data.email);
          const phone =
            data.phone === undefined
              ? primaryContact.phone
              : nullableClientContactText(data.phone);

          await tx.clientContact.update({
            where: {
              id: primaryContact.id,
            },
            data: {
              email,
              phone,
              ...clientContactIdentity({
                email,
                phone,
                whatsapp: primaryContact.whatsapp,
              }),
            },
          });
          await syncClientPrimaryContact(
            tx,
            user.companyId,
            updatedClient.id,
          );
        } else if (data.email?.trim() || data.phone?.trim()) {
          const primaryContact = await ensureClientContactFromSnapshot({
            db: tx,
            companyId: user.companyId,
            clientId: updatedClient.id,
            name: updatedClient.name,
            email: data.email,
            phone: data.phone,
          });

          if (primaryContact.created) {
            await logActivity({
              companyId: user.companyId,
              userId: user.id,
              action: ActivityAction.CONTACT_CREATED,
              entityType: "ClientContact",
              entityId: primaryContact.contact.id,
              message: `تمت إضافة جهة الاتصال الرئيسية للعميل ${updatedClient.name}: ${primaryContact.contact.name}`,
              metadata: {
                clientId: updatedClient.id,
                isPrimary: primaryContact.contact.isPrimary,
              },
              ipAddress: meta.ipAddress,
              userAgent: meta.userAgent,
              db: tx,
            });
          }
        }
      }

      const message =
        action === ActivityAction.CLIENT_ARCHIVED
          ? `تم أرشفة العميل: ${updatedClient.name}`
          : action === ActivityAction.CLIENT_RESTORED
            ? `تم استرجاع العميل: ${updatedClient.name}`
            : `تم تعديل بيانات العميل: ${updatedClient.name}`;

      await logActivity({
        companyId: user.companyId,
        userId: user.id,
        action,
        entityType: "Client",
        entityId: updatedClient.id,
        message,
        metadata: {
          status: updatedClient.status,
          type: updatedClient.type,
          source: updatedClient.source,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      });

      return updatedClient;
    });

    return ok({ client });
  } catch (error) {
    return handleApiError(
      error,
      "CLIENT_PATCH_ERROR",
      "حدث خطأ أثناء تعديل العميل",
    );
  }
}
