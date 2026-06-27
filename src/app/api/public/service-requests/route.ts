import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ActivityAction,
  NotificationType,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const intakeSchema = z.object({
  customerName: z.string().trim().min(2, "اسم العميل مطلوب"),
  customerEmail: z
    .string()
    .trim()
    .email("الإيميل غير صحيح")
    .optional()
    .nullable(),
  customerPhone: z.string().trim().optional().nullable(),
  customerCompany: z.string().trim().optional().nullable(),

  serviceType: z.string().trim().min(2, "نوع الخدمة مطلوب"),
  budgetRange: z.string().trim().optional().nullable(),
  timeline: z.string().trim().optional().nullable(),
  message: z.string().trim().optional().nullable(),

  workflowRunId: z.string().trim().optional().nullable(),
});

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getSecret(request: Request) {
  return (
    request.headers.get("x-aquaflow-intake-secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "") ||
    ""
  );
}

export async function POST(request: Request) {
  const expectedSecret = process.env.WEBSITE_INTAKE_SECRET;
  const receivedSecret = getSecret(request);

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unauthorized",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = intakeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message:
          parsed.error.issues[0]?.message ?? "بيانات طلب الخدمة غير صحيحة",
      },
      { status: 400 },
    );
  }

  const companySlug = process.env.AQUA_COMPANY_SLUG || "aqua-tech";

  const company = await prisma.company.findUnique({
    where: {
      slug: companySlug,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!company) {
    return NextResponse.json(
      {
        ok: false,
        message: "Company not found",
      },
      { status: 404 },
    );
  }

  const data = parsed.data;

  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      companyId: company.id,

      customerName: data.customerName,
      customerEmail: nullableText(data.customerEmail),
      customerPhone: nullableText(data.customerPhone),
      customerCompany: nullableText(data.customerCompany),

      serviceType: data.serviceType,
      budgetRange: nullableText(data.budgetRange),
      timeline: nullableText(data.timeline),
      message: nullableText(data.message),

      status: "NEW",
      source: "WEBSITE",
      priority: "MEDIUM",

      workflowRunId: nullableText(data.workflowRunId),
    },
  });

  await prisma.activityLog.create({
    data: {
      companyId: company.id,
      userId: null,
      action: ActivityAction.SERVICE_REQUEST_CREATED,
      entityType: "ServiceRequest",
      entityId: serviceRequest.id,
      message: `وصل طلب خدمة جديد من الموقع: ${serviceRequest.customerName}`,
      metadata: {
        source: "WEBSITE",
        customerName: serviceRequest.customerName,
        customerEmail: serviceRequest.customerEmail,
        customerPhone: serviceRequest.customerPhone,
        serviceType: serviceRequest.serviceType,
      },
    },
  });

  const notifyUsers = await prisma.user.findMany({
    where: {
      companyId: company.id,
      isActive: true,
      role: {
        in: ["OWNER", "ADMIN", "SALES", "PROJECT_MANAGER"],
      },
    },
    select: {
      id: true,
    },
  });

  if (notifyUsers.length > 0) {
    await prisma.notification.createMany({
      data: notifyUsers.map((user) => ({
        companyId: company.id,
        userId: user.id,
        title: "طلب خدمة جديد",
        message: `${serviceRequest.customerName} أرسل طلب ${serviceRequest.serviceType}`,
        type: NotificationType.INFO,
        entityType: "ServiceRequest",
        entityId: serviceRequest.id,
      })),
    });
  }

  return NextResponse.json(
    {
      ok: true,
      serviceRequestId: serviceRequest.id,
    },
    { status: 201 },
  );
}