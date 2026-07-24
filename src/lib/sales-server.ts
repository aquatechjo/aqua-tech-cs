import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import type {
  SalesActivityType,
  SalesOpportunityStage,
} from "@/generated/prisma/enums"
import { ApiError } from "@/lib/api-response"
import { minorToMoney, parseScaledDecimal } from "@/lib/finance"
import { nextDocumentNumber } from "@/lib/finance-server"
import { prisma } from "@/lib/prisma"
import {
  defaultProbability,
  serviceRequestStatusFromStage,
  stageFromServiceRequestStatus,
} from "@/lib/sales"

type DatabaseClient = Prisma.TransactionClient | typeof prisma

const contactActivityTypes = new Set<SalesActivityType>([
  "CALL",
  "WHATSAPP",
  "EMAIL",
  "MEETING",
  "FOLLOW_UP",
])

export function nullableSalesText(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export function optionalSalesDate(value?: string | null) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ApiError("التاريخ المدخل غير صحيح", 400, "INVALID_DATE")
  }

  return date
}

export function salesValue(value: string | number | null | undefined) {
  try {
    return minorToMoney(parseScaledDecimal(value ?? "0"))
  } catch {
    throw new ApiError(
      "قيمة الفرصة يجب أن تكون رقمًا موجبًا بدقتين عشريتين كحد أقصى",
      400,
      "INVALID_OPPORTUNITY_VALUE",
    )
  }
}

export async function assertSalesCurrency(
  db: DatabaseClient,
  companyId: string,
  currency: string,
) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { currency: true },
  })

  if (!company) {
    throw new ApiError("الشركة غير موجودة", 404, "COMPANY_NOT_FOUND")
  }

  if (company.currency !== currency) {
    throw new ApiError(
      `لوحة المبيعات تستخدم عملة الشركة ${company.currency} حتى تبقى مؤشرات خط المبيعات قابلة للجمع`,
      400,
      "SALES_CURRENCY_MISMATCH",
    )
  }

  return company.currency
}

export async function assertSalesOwner(
  db: DatabaseClient,
  companyId: string,
  ownerId?: string | null,
) {
  if (!ownerId) return null

  const owner = await db.user.findFirst({
    where: {
      id: ownerId,
      companyId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  })

  if (!owner) {
    throw new ApiError(
      "مسؤول الفرصة غير موجود أو غير فعال",
      404,
      "SALES_OWNER_NOT_FOUND",
    )
  }

  return owner
}

export async function resolveOpportunityLinks({
  db,
  companyId,
  clientId,
  serviceRequestId,
}: {
  db: DatabaseClient
  companyId: string
  clientId?: string | null
  serviceRequestId?: string | null
}) {
  let resolvedClientId = clientId || null
  const resolvedServiceRequestId = serviceRequestId || null
  let serviceRequest: {
    id: string
    clientId: string | null
    projectId: string | null
    assignedToId: string | null
    customerName: string
    customerEmail: string | null
    customerPhone: string | null
    customerCompany: string | null
    serviceType: string
    source: string
    priority: string
    status: string
    message: string | null
  } | null = null

  if (resolvedClientId) {
    const client = await db.client.findFirst({
      where: { id: resolvedClientId, companyId },
      select: { id: true },
    })

    if (!client) {
      throw new ApiError("العميل المحدد غير موجود", 404, "CLIENT_NOT_FOUND")
    }
  }

  if (resolvedServiceRequestId) {
    serviceRequest = await db.serviceRequest.findFirst({
      where: { id: resolvedServiceRequestId, companyId },
      select: {
        id: true,
        clientId: true,
        projectId: true,
        assignedToId: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        customerCompany: true,
        serviceType: true,
        source: true,
        priority: true,
        status: true,
        message: true,
      },
    })

    if (!serviceRequest) {
      throw new ApiError(
        "طلب الخدمة المحدد غير موجود",
        404,
        "SERVICE_REQUEST_NOT_FOUND",
      )
    }

    if (
      resolvedClientId &&
      serviceRequest.clientId &&
      serviceRequest.clientId !== resolvedClientId
    ) {
      throw new ApiError(
        "طلب الخدمة لا يتبع العميل المحدد",
        400,
        "SERVICE_REQUEST_CLIENT_MISMATCH",
      )
    }

    resolvedClientId ??= serviceRequest.clientId
  }

  return {
    clientId: resolvedClientId,
    serviceRequestId: resolvedServiceRequestId,
    serviceRequest,
  }
}

export function opportunitySeedFromServiceRequest(serviceRequest: {
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  customerCompany: string | null
  serviceType: string
  source: string
  priority: string
  status: string
  assignedToId: string | null
  message: string | null
}) {
  const stage = stageFromServiceRequestStatus(serviceRequest.status)

  return {
    title: `${serviceRequest.serviceType} - ${
      serviceRequest.customerCompany?.trim() || serviceRequest.customerName
    }`,
    contactName: serviceRequest.customerName,
    companyName: serviceRequest.customerCompany,
    email: serviceRequest.customerEmail,
    phone: serviceRequest.customerPhone,
    serviceType: serviceRequest.serviceType,
    source: serviceRequest.source,
    priority: serviceRequest.priority,
    ownerId: serviceRequest.assignedToId,
    stage,
    probability: defaultProbability(stage),
    lostReason: stage === "LOST" ? "مرفوض من طلب الخدمة" : null,
    lostAt: stage === "LOST" ? new Date() : null,
    wonAt: stage === "WON" ? new Date() : null,
    notes: serviceRequest.message,
  }
}

export async function syncServiceRequestStage(
  db: DatabaseClient,
  companyId: string,
  serviceRequestId: string | null,
  stage: SalesOpportunityStage,
) {
  if (!serviceRequestId) return

  const status = serviceRequestStatusFromStage(stage)
  if (!status) return

  const now = new Date()

  await db.serviceRequest.updateMany({
    where: {
      id: serviceRequestId,
      companyId,
      status: { not: "CONVERTED" },
    },
    data: {
      status,
      ...(status === "PROPOSAL_SENT" ? { proposalSentAt: now } : {}),
      ...(status === "REJECTED" ? { rejectedAt: now } : {}),
    },
  })
}

export function isContactActivity(type: SalesActivityType) {
  return contactActivityTypes.has(type)
}

export async function refreshOpportunityFollowUp(
  db: DatabaseClient,
  companyId: string,
  opportunityId: string,
) {
  const nextActivity = await db.salesActivity.findFirst({
    where: {
      companyId,
      opportunityId,
      status: "PLANNED",
      scheduledAt: { not: null },
    },
    orderBy: { scheduledAt: "asc" },
    select: { scheduledAt: true },
  })

  return db.salesOpportunity.update({
    where: { id: opportunityId },
    data: { nextFollowUpAt: nextActivity?.scheduledAt ?? null },
  })
}

export async function nextProposalNumber(
  db: DatabaseClient,
  companyId: string,
  timeZone: string,
) {
  return nextDocumentNumber(db, companyId, "PROP", new Date(), timeZone)
}

export async function nextProposalVersion(
  db: DatabaseClient,
  companyId: string,
  opportunityId: string,
) {
  const latest = await db.salesProposal.aggregate({
    where: { companyId, opportunityId },
    _max: { version: true },
  })

  return (latest._max.version ?? 0) + 1
}
