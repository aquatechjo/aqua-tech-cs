import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import {
  ActivityAction,
  NotificationType,
} from "@/generated/prisma/enums";
import {
  ApiError,
  err,
  ok,
  withApiHandler,
} from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  buildIdempotencyKey,
  getClientIp,
  readJsonBody,
  safeEqualSecrets,
} from "@/lib/request-security";

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

  workflowRunId: z.string().trim().max(160).optional().nullable(),
});

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getSecret(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return request.headers.get("x-aquaflow-intake-secret")?.trim() || "";
}

async function findReplay(companyId: string, idempotencyKey: string) {
  return prisma.serviceRequest.findUnique({
    where: {
      companyId_idempotencyKey: {
        companyId,
        idempotencyKey,
      },
    },
    select: {
      id: true,
    },
  });
}

async function createWebsiteServiceRequest(request: Request) {
  const expectedSecret = process.env.WEBSITE_INTAKE_SECRET?.trim();

  if (!expectedSecret) {
    throw new ApiError(
      "Website intake is not configured",
      503,
      "INTAKE_NOT_CONFIGURED",
    );
  }

  await enforceRateLimit({
    namespace: "website-intake",
    identifier: getClientIp(request),
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });

  const receivedSecret = getSecret(request);

  if (!receivedSecret || !safeEqualSecrets(receivedSecret, expectedSecret)) {
    return err("Unauthorized", 401, {
      code: "UNAUTHORIZED",
    });
  }

  const body = await readJsonBody(request, 32 * 1024);
  const parsed = intakeSchema.safeParse(body);

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

  const companySlug = process.env.AQUA_COMPANY_SLUG?.trim() || "aqua-tech";

  const company = await prisma.company.findUnique({
    where: {
      slug: companySlug,
    },
    select: {
      id: true,
    },
  });

  if (!company) {
    return err("Company not found", 404, {
      code: "COMPANY_NOT_FOUND",
    });
  }

  const data = parsed.data;
  const idempotencyKey = buildIdempotencyKey(
    request.headers.get("idempotency-key"),
    data.workflowRunId,
  );

  if (idempotencyKey) {
    const existingRequest = await findReplay(company.id, idempotencyKey);

    if (existingRequest) {
      return ok({
        serviceRequestId: existingRequest.id,
        replayed: true,
      });
    }
  }

  try {
    const serviceRequest = await prisma.$transaction(async (tx) => {
      const createdRequest = await tx.serviceRequest.create({
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
          idempotencyKey,
        },
      });

      await tx.activityLog.create({
        data: {
          companyId: company.id,
          userId: null,
          action: ActivityAction.SERVICE_REQUEST_CREATED,
          entityType: "ServiceRequest",
          entityId: createdRequest.id,
          message: `وصل طلب خدمة جديد من الموقع: ${createdRequest.customerName}`,
          metadata: {
            source: "WEBSITE",
            serviceType: createdRequest.serviceType,
          },
        },
      });

      const notifyUsers = await tx.user.findMany({
        where: {
          companyId: company.id,
          isActive: true,
          role: {
            in: [
              "OWNER",
              "ADMIN",
              "SALES_MANAGER",
              "OPERATIONS_MANAGER",
            ],
          },
        },
        select: {
          id: true,
        },
      });

      if (notifyUsers.length > 0) {
        await tx.notification.createMany({
          data: notifyUsers.map((user) => ({
            companyId: company.id,
            userId: user.id,
            title: "طلب خدمة جديد",
            message: `${createdRequest.customerName} أرسل طلب ${createdRequest.serviceType}`,
            type: NotificationType.INFO,
            entityType: "ServiceRequest",
            entityId: createdRequest.id,
          })),
        });
      }

      return createdRequest;
    });

    return ok(
      {
        serviceRequestId: serviceRequest.id,
        replayed: false,
      },
      201,
    );
  } catch (error) {
    if (
      idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingRequest = await findReplay(company.id, idempotencyKey);

      if (existingRequest) {
        return ok({
          serviceRequestId: existingRequest.id,
          replayed: true,
        });
      }
    }

    throw error;
  }
}

export const POST = withApiHandler(
  "PUBLIC_SERVICE_REQUEST_ERROR",
  createWebsiteServiceRequest,
  "حدث خطأ أثناء استقبال طلب الخدمة",
);
