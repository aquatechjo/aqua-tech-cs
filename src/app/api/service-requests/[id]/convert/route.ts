import { ActivityAction, type LeadSource } from "@/generated/prisma/enums";
import { ACCESS_ROLES, assertRole } from "@/lib/access-control";
import { err, ok, withApiHandler } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProjectWithWorkflow } from "@/lib/project-workflow-server";
import { assertSameOrigin } from "@/lib/request-security";
import { wonOpportunityState } from "@/lib/sales";
import { opportunitySeedFromServiceRequest } from "@/lib/sales-server";

function leadSource(source: string): LeadSource {
  if (
    source === "WEBSITE" ||
    source === "FACEBOOK" ||
    source === "INSTAGRAM" ||
    source === "WHATSAPP" ||
    source === "REFERRAL"
  ) {
    return source;
  }

  return source === "MANUAL" ? "DIRECT" : "OTHER";
}

async function convertServiceRequest(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  assertSameOrigin(request);

  const user = await requireAuth();

  assertRole(
    user.role,
    ACCESS_ROLES.serviceRequestManagement,
    "لا تملك صلاحية تحويل طلبات الخدمة",
  );

  const { id } = await context.params;

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "ServiceRequest"
      WHERE "id" = ${id} AND "companyId" = ${user.companyId}
      FOR UPDATE
    `;

    const serviceRequest = await tx.serviceRequest.findFirst({
      where: {
        id,
        companyId: user.companyId,
      },
    });

    if (!serviceRequest) {
      return null;
    }

    if (
      serviceRequest.status === "CONVERTED" &&
      serviceRequest.clientId &&
      serviceRequest.projectId
    ) {
      return {
        serviceRequest,
        clientId: serviceRequest.clientId,
        projectId: serviceRequest.projectId,
        replayed: true,
      };
    }

    let clientId = serviceRequest.clientId;

    if (!clientId) {
      const client = await tx.client.create({
        data: {
          companyId: user.companyId,
          name:
            serviceRequest.customerCompany?.trim() ||
            serviceRequest.customerName,
          email: serviceRequest.customerEmail,
          phone: serviceRequest.customerPhone,
          type: serviceRequest.customerCompany ? "COMPANY" : "INDIVIDUAL",
          status: "ACTIVE",
          source: leadSource(serviceRequest.source),
          notes: serviceRequest.message,
        },
      });

      clientId = client.id;
    }

    let projectId = serviceRequest.projectId;

    if (!projectId) {
      const created = await createProjectWithWorkflow(tx, {
        companyId: user.companyId,
        createdById: user.id,
        templateHint: serviceRequest.serviceType,
        project: {
          clientId,
          name: `${serviceRequest.serviceType} - ${
            serviceRequest.customerCompany?.trim() ||
            serviceRequest.customerName
          }`,
          description: serviceRequest.message,
          status: "PLANNING",
          priority: serviceRequest.priority,
          currency: user.company.currency,
        },
      });

      projectId = created.project.id;
    }

    const convertedAt = serviceRequest.convertedAt ?? new Date();
    const convertedRequest = await tx.serviceRequest.update({
      where: {
        id: serviceRequest.id,
      },
      data: {
        clientId,
        projectId,
        status: "CONVERTED",
        convertedAt,
      },
    });

    const existingOpportunity = await tx.salesOpportunity.findUnique({
      where: {
        serviceRequestId: serviceRequest.id,
      },
      select: {
        id: true,
      },
    });

    let salesOpportunityId: string;

    if (existingOpportunity) {
      const updatedOpportunity = await tx.salesOpportunity.update({
        where: {
          id: existingOpportunity.id,
        },
        data: {
          clientId,
          projectId,
          ...wonOpportunityState(convertedAt),
        },
      });
      salesOpportunityId = updatedOpportunity.id;
    } else {
      const seed = opportunitySeedFromServiceRequest(serviceRequest);
      const opportunity = await tx.salesOpportunity.create({
        data: {
          companyId: user.companyId,
          serviceRequestId: serviceRequest.id,
          clientId,
          projectId,
          ownerId: seed.ownerId,
          title: seed.title,
          contactName: seed.contactName,
          companyName: seed.companyName,
          email: seed.email,
          phone: seed.phone,
          serviceType: seed.serviceType,
          stage: "WON",
          priority: serviceRequest.priority,
          source: serviceRequest.source,
          estimatedValue: "0.00",
          currency: user.company.currency,
          probability: 100,
          wonAt: convertedAt,
          notes: seed.notes,
        },
      });
      salesOpportunityId = opportunity.id;
    }

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.SERVICE_REQUEST_CONVERTED,
        entityType: "ServiceRequest",
        entityId: convertedRequest.id,
        message: `تم تحويل طلب الخدمة إلى عميل ومشروع: ${convertedRequest.customerName}`,
        metadata: {
          clientId,
          projectId,
          serviceType: convertedRequest.serviceType,
        },
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.SALES_OPPORTUNITY_CONVERTED,
        entityType: "SalesOpportunity",
        entityId: salesOpportunityId,
        message: `تم توثيق فرصة البيع الفائزة: ${convertedRequest.customerName}`,
        metadata: {
          serviceRequestId: convertedRequest.id,
          clientId,
          projectId,
        },
      },
    });

    return {
      serviceRequest: convertedRequest,
      salesOpportunityId,
      clientId,
      projectId,
      replayed: false,
    };
  });

  if (!result) {
    return err("طلب الخدمة غير موجود", 404, {
      code: "SERVICE_REQUEST_NOT_FOUND",
    });
  }

  return ok(result);
}

export const POST = withApiHandler(
  "SERVICE_REQUEST_CONVERT_ERROR",
  convertServiceRequest,
  "حدث خطأ أثناء تحويل طلب الخدمة",
);
