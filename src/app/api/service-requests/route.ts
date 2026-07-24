import { z } from "zod";
import { ActivityAction } from "@/generated/prisma/enums";
import { ACCESS_ROLES, assertRole } from "@/lib/access-control";
import { err, ok, withApiHandler } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, readJsonBody } from "@/lib/request-security";

const serviceRequestSchema = z.object({
  clientId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),

  customerName: z.string().trim().min(2, "اسم العميل مطلوب"),
  customerEmail: z.string().trim().email("الإيميل غير صحيح").optional().nullable(),
  customerPhone: z.string().trim().optional().nullable(),
  customerCompany: z.string().trim().optional().nullable(),

  serviceType: z.string().trim().min(2, "نوع الخدمة مطلوب"),
  budgetRange: z.string().trim().optional().nullable(),
  timeline: z.string().trim().optional().nullable(),
  message: z.string().trim().optional().nullable(),

  status: z
    .enum([
      "NEW",
      "CONTACTED",
      "QUALIFIED",
      "PROPOSAL_SENT",
      "APPROVED",
      "REJECTED",
      "CONVERTED",
      "ARCHIVED",
    ])
    .default("NEW"),

  source: z
    .enum(["WEBSITE", "MANUAL", "WHATSAPP", "INSTAGRAM", "FACEBOOK", "REFERRAL", "OTHER"])
    .default("MANUAL"),

  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),

  workflowRunId: z.string().trim().optional().nullable(),
  proposalUrl: z.string().trim().optional().nullable(),
});

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function getServiceRequests() {
  const user = await requireAuth();

  assertRole(
    user.role,
    ACCESS_ROLES.serviceRequestManagement,
    "لا تملك صلاحية عرض طلبات الخدمة",
  );

  const serviceRequests = await prisma.serviceRequest.findMany({
    where: {
      companyId: user.companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return ok({ serviceRequests });
}

async function createServiceRequest(request: Request) {
  assertSameOrigin(request);

  const user = await requireAuth();

  assertRole(
    user.role,
    ACCESS_ROLES.serviceRequestManagement,
    "لا تملك صلاحية إضافة طلبات الخدمة",
  );

  const body = await readJsonBody(request);

  const parsed = serviceRequestSchema.safeParse(body);

  if (!parsed.success) {
    return err(
      parsed.error.issues[0]?.message ?? "بيانات طلب الخدمة غير صحيحة",
      400,
      {
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
    );
  }

  const data = parsed.data;

  let safeClientId: string | null = data.clientId || null;
  const safeProjectId: string | null = data.projectId || null;
  const safeAssignedToId: string | null = data.assignedToId || null;

  if (safeProjectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: safeProjectId,
        companyId: user.companyId,
      },
      select: {
        id: true,
        clientId: true,
      },
    });

    if (!project) {
      return err("المشروع المحدد غير موجود", 404, {
        code: "PROJECT_NOT_FOUND",
      });
    }

    if (!safeClientId && project.clientId) {
      safeClientId = project.clientId;
    }
  }

  if (safeClientId) {
    const client = await prisma.client.findFirst({
      where: {
        id: safeClientId,
        companyId: user.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!client) {
      return err("العميل المحدد غير موجود", 404, {
        code: "CLIENT_NOT_FOUND",
      });
    }
  }

  if (safeAssignedToId) {
    const assignedUser = await prisma.user.findFirst({
      where: {
        id: safeAssignedToId,
        companyId: user.companyId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!assignedUser) {
      return err("الموظف المحدد غير موجود أو غير فعال", 404, {
        code: "ASSIGNEE_NOT_FOUND",
      });
    }
  }

  const now = new Date();

  const serviceRequest = await prisma.$transaction(async (tx) => {
    const createdRequest = await tx.serviceRequest.create({
      data: {
        companyId: user.companyId,
        clientId: safeClientId,
        projectId: safeProjectId,
        assignedToId: safeAssignedToId,

        customerName: data.customerName,
        customerEmail: nullableText(data.customerEmail),
        customerPhone: nullableText(data.customerPhone),
        customerCompany: nullableText(data.customerCompany),

        serviceType: data.serviceType,
        budgetRange: nullableText(data.budgetRange),
        timeline: nullableText(data.timeline),
        message: nullableText(data.message),

        status: data.status,
        source: data.source,
        priority: data.priority,

        workflowRunId: nullableText(data.workflowRunId),
        proposalUrl: nullableText(data.proposalUrl),

        proposalSentAt: data.status === "PROPOSAL_SENT" ? now : null,
        approvedAt: data.status === "APPROVED" ? now : null,
        rejectedAt: data.status === "REJECTED" ? now : null,
        convertedAt: data.status === "CONVERTED" ? now : null,
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.SERVICE_REQUEST_CREATED,
        entityType: "ServiceRequest",
        entityId: createdRequest.id,
        message: `تم إضافة طلب خدمة جديد: ${createdRequest.customerName}`,
        metadata: {
          customerName: createdRequest.customerName,
          serviceType: createdRequest.serviceType,
          source: createdRequest.source,
          status: createdRequest.status,
          priority: createdRequest.priority,
        },
      },
    });

    return createdRequest;
  });

  return ok({ serviceRequest }, 201);
}

export const GET = withApiHandler(
  "SERVICE_REQUESTS_GET_ERROR",
  getServiceRequests,
);
export const POST = withApiHandler(
  "SERVICE_REQUESTS_POST_ERROR",
  createServiceRequest,
  "حدث خطأ أثناء إضافة طلب الخدمة",
);
