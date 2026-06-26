import { z } from "zod";
import {
  ActivityAction,
  ClientStatus,
  ClientType,
  LeadSource,
} from "@/generated/prisma/enums";
import { err, ok } from "@/lib/api-response";
import { getRequestMeta, requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";

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
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
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

    const client = await prisma.client.update({
      where: { id },
      data: {
        name: data.name?.trim(),
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
    });

    let action: ActivityAction = ActivityAction.CLIENT_UPDATED;
    let message = `تم تعديل بيانات العميل: ${client.name}`;

    if (data.status === "ARCHIVED") {
      action = ActivityAction.CLIENT_ARCHIVED;
      message = `تم أرشفة العميل: ${client.name}`;
    }

    if (
      existingClient.status === "ARCHIVED" &&
      data.status &&
      data.status !== "ARCHIVED"
    ) {
      action = ActivityAction.CLIENT_RESTORED;
      message = `تم استرجاع العميل: ${client.name}`;
    }

    await logActivity({
      companyId: user.companyId,
      userId: user.id,
      action,
      entityType: "Client",
      entityId: client.id,
      message,
      metadata: {
        status: client.status,
        type: client.type,
        source: client.source,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok({ client });
  } catch (error) {
    console.error("[CLIENT_PATCH_ERROR]", error);
    return err("حدث خطأ أثناء تعديل العميل", 500);
  }
}
