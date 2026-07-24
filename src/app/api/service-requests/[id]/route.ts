import { z } from "zod";
import {
  ActivityAction,
  ServiceRequestStatus,
} from "@/generated/prisma/enums";
import { ACCESS_ROLES, assertRole } from "@/lib/access-control";
import { err, ok, withApiHandler } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, readJsonBody } from "@/lib/request-security";

const updateServiceRequestSchema = z.object({
  clientId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),

  customerName: z.string().trim().min(2).optional(),
  customerEmail: z.string().trim().email().optional().nullable(),
  customerPhone: z.string().trim().optional().nullable(),
  customerCompany: z.string().trim().optional().nullable(),

  serviceType: z.string().trim().min(2).optional(),
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
    .optional(),

  source: z
    .enum(["WEBSITE", "MANUAL", "WHATSAPP", "INSTAGRAM", "FACEBOOK", "REFERRAL", "OTHER"])
    .optional(),

  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),

  workflowRunId: z.string().trim().optional().nullable(),
  proposalUrl: z.string().trim().optional().nullable(),
});

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getActionForStatusChange(
  previousStatus: ServiceRequestStatus,
  nextStatus: ServiceRequestStatus | undefined,
): ActivityAction {
  if (!nextStatus) {
    return ActivityAction.SERVICE_REQUEST_UPDATED;
  }

  if (nextStatus === "CONTACTED" && previousStatus !== "CONTACTED") {
    return ActivityAction.SERVICE_REQUEST_CONTACTED;
  }

  if (nextStatus === "PROPOSAL_SENT" && previousStatus !== "PROPOSAL_SENT") {
    return ActivityAction.SERVICE_REQUEST_PROPOSAL_SENT;
  }

  if (nextStatus === "APPROVED" && previousStatus !== "APPROVED") {
    return ActivityAction.SERVICE_REQUEST_APPROVED;
  }

  if (nextStatus === "REJECTED" && previousStatus !== "REJECTED") {
    return ActivityAction.SERVICE_REQUEST_REJECTED;
  }

  if (nextStatus === "CONVERTED" && previousStatus !== "CONVERTED") {
    return ActivityAction.SERVICE_REQUEST_CONVERTED;
  }

  if (nextStatus === "ARCHIVED" && previousStatus !== "ARCHIVED") {
    return ActivityAction.SERVICE_REQUEST_ARCHIVED;
  }

  if (previousStatus === "ARCHIVED" && nextStatus !== "ARCHIVED") {
    return ActivityAction.SERVICE_REQUEST_RESTORED;
  }

  return ActivityAction.SERVICE_REQUEST_UPDATED;
}

async function getServiceRequest(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth();

  assertRole(
    user.role,
    ACCESS_ROLES.serviceRequestManagement,
    "لا تملك صلاحية عرض طلبات الخدمة",
  );

  const { id } = await context.params;

  const serviceRequest = await prisma.serviceRequest.findFirst({
    where: {
      id,
      companyId: user.companyId,
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

  if (!serviceRequest) {
    return err("طلب الخدمة غير موجود", 404, {
      code: "SERVICE_REQUEST_NOT_FOUND",
    });
  }

  return ok({ serviceRequest });
}

async function updateServiceRequest(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  assertSameOrigin(request);

  const user = await requireAuth();

  assertRole(
    user.role,
    ACCESS_ROLES.serviceRequestManagement,
    "لا تملك صلاحية تعديل طلبات الخدمة",
  );

  const { id } = await context.params;

  const body = await readJsonBody(request);
  const parsed = updateServiceRequestSchema.safeParse(body);

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

  const existingRequest = await prisma.serviceRequest.findFirst({
    where: {
      id,
      companyId: user.companyId,
    },
  });

  if (!existingRequest) {
    return err("طلب الخدمة غير موجود", 404, {
      code: "SERVICE_REQUEST_NOT_FOUND",
    });
  }

  const data = parsed.data;

  let safeClientId =
    data.clientId !== undefined ? data.clientId || null : existingRequest.clientId;

  const safeProjectId =
    data.projectId !== undefined ? data.projectId || null : existingRequest.projectId;

  const safeAssignedToId =
    data.assignedToId !== undefined
      ? data.assignedToId || null
      : existingRequest.assignedToId;

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

    if (data.clientId === undefined && project.clientId) {
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

  const action = getActionForStatusChange(existingRequest.status, data.status);
  const now = new Date();

  const serviceRequest = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.serviceRequest.update({
      where: {
        id: existingRequest.id,
      },
      data: {
        ...(data.clientId !== undefined || data.projectId !== undefined
          ? { clientId: safeClientId }
          : {}),
        ...(data.projectId !== undefined ? { projectId: safeProjectId } : {}),
        ...(data.assignedToId !== undefined
          ? { assignedToId: safeAssignedToId }
          : {}),

        ...(data.customerName !== undefined
          ? { customerName: data.customerName }
          : {}),
        ...(data.customerEmail !== undefined
          ? { customerEmail: nullableText(data.customerEmail) }
          : {}),
        ...(data.customerPhone !== undefined
          ? { customerPhone: nullableText(data.customerPhone) }
          : {}),
        ...(data.customerCompany !== undefined
          ? { customerCompany: nullableText(data.customerCompany) }
          : {}),

        ...(data.serviceType !== undefined
          ? { serviceType: data.serviceType }
          : {}),
        ...(data.budgetRange !== undefined
          ? { budgetRange: nullableText(data.budgetRange) }
          : {}),
        ...(data.timeline !== undefined
          ? { timeline: nullableText(data.timeline) }
          : {}),
        ...(data.message !== undefined
          ? { message: nullableText(data.message) }
          : {}),

        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),

        ...(data.workflowRunId !== undefined
          ? { workflowRunId: nullableText(data.workflowRunId) }
          : {}),
        ...(data.proposalUrl !== undefined
          ? { proposalUrl: nullableText(data.proposalUrl) }
          : {}),

        ...(data.status === "PROPOSAL_SENT" && !existingRequest.proposalSentAt
          ? { proposalSentAt: now }
          : {}),
        ...(data.status === "APPROVED" && !existingRequest.approvedAt
          ? { approvedAt: now }
          : {}),
        ...(data.status === "REJECTED" && !existingRequest.rejectedAt
          ? { rejectedAt: now }
          : {}),
        ...(data.status === "CONVERTED" && !existingRequest.convertedAt
          ? { convertedAt: now }
          : {}),
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action,
        entityType: "ServiceRequest",
        entityId: updatedRequest.id,
        message: `تم تعديل طلب الخدمة: ${updatedRequest.customerName}`,
        metadata: {
          customerName: updatedRequest.customerName,
          serviceType: updatedRequest.serviceType,
          status: updatedRequest.status,
          source: updatedRequest.source,
          priority: updatedRequest.priority,
          clientId: updatedRequest.clientId,
          projectId: updatedRequest.projectId,
          assignedToId: updatedRequest.assignedToId,
        },
      },
    });

    return updatedRequest;
  });

  return ok({ serviceRequest });
}

export const GET = withApiHandler(
  "SERVICE_REQUEST_GET_ERROR",
  getServiceRequest,
);
export const PATCH = withApiHandler(
  "SERVICE_REQUEST_PATCH_ERROR",
  updateServiceRequest,
  "حدث خطأ أثناء تعديل طلب الخدمة",
);
