import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError } from "@/lib/api-response"
import {
  leadCompletionScore,
  leadIdentity,
  leadLifecycleDates,
  leadSourceFromServiceRequest,
  leadStatusFromServiceRequest,
  type ServiceRequestSourceValue,
  type ServiceRequestStatusValue,
} from "@/lib/crm-lead"
import { prisma } from "@/lib/prisma"

type DatabaseClient = Prisma.TransactionClient | typeof prisma

const leadOwnerRoles = [
  "OWNER",
  "ADMIN",
  "SALES_MANAGER",
  "OPERATIONS_MANAGER",
] as const

type LeadServiceRequest = {
  id: string
  clientId: string | null
  assignedToId: string | null
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  customerCompany: string | null
  serviceType: string
  budgetRange: string | null
  timeline: string | null
  message: string | null
  status: ServiceRequestStatusValue
  source: ServiceRequestSourceValue
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
}

export async function resolveLeadOwnerId(
  db: DatabaseClient,
  companyId: string,
  assignedToId: string | null,
) {
  if (assignedToId) return assignedToId

  const salesManager = await db.user.findFirst({
    where: {
      companyId,
      isActive: true,
      role: "SALES_MANAGER",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  if (salesManager) return salesManager.id

  const owner = await db.user.findFirst({
    where: {
      companyId,
      isActive: true,
      role: "OWNER",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  return owner?.id ?? null
}

export async function assertLeadOwner(
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
      role: {
        in: [...leadOwnerRoles],
      },
    },
    select: {
      id: true,
      name: true,
    },
  })

  if (!owner) {
    throw new ApiError(
      "مسؤول العميل المحتمل غير موجود أو لا يملك صلاحية المبيعات",
      404,
      "LEAD_OWNER_NOT_FOUND",
    )
  }

  return owner
}

export function nullableLeadText(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export function optionalLeadDate(value?: string | null) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(
      "تاريخ الإجراء التالي غير صحيح",
      400,
      "INVALID_LEAD_NEXT_ACTION_DATE",
    )
  }

  return date
}

export async function findPossibleDuplicateId(
  db: DatabaseClient,
  companyId: string,
  identity: {
    emailNormalized: string | null
    phoneNormalized: string | null
  },
  excludeLeadId?: string,
) {
  const identityMatches = [
    ...(identity.emailNormalized
      ? [{ emailNormalized: identity.emailNormalized }]
      : []),
    ...(identity.phoneNormalized
      ? [{ phoneNormalized: identity.phoneNormalized }]
      : []),
  ]

  if (identityMatches.length === 0) return null

  const possibleDuplicate = await db.lead.findFirst({
    where: {
      companyId,
      ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
      status: {
        notIn: ["DUPLICATE", "SPAM", "ARCHIVED"],
      },
      OR: identityMatches,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  return possibleDuplicate?.id ?? null
}

export async function syncLeadForServiceRequest({
  db,
  companyId,
  serviceRequest,
  actorUserId,
  now = new Date(),
}: {
  db: DatabaseClient
  companyId: string
  serviceRequest: LeadServiceRequest
  actorUserId?: string | null
  now?: Date
}) {
  const existing = await db.lead.findUnique({
    where: { serviceRequestId: serviceRequest.id },
  })

  if (!existing) {
    return createLeadForServiceRequest({
      db,
      companyId,
      serviceRequest,
      actorUserId,
      now,
    })
  }

  const identity = leadIdentity({
    email: serviceRequest.customerEmail,
    phone: serviceRequest.customerPhone,
    companyName: serviceRequest.customerCompany,
  })
  const status = leadStatusFromServiceRequest(serviceRequest.status)
  const ownerId =
    serviceRequest.assignedToId ??
    existing.ownerId ??
    (await resolveLeadOwnerId(db, companyId, null))
  const possibleDuplicateOfId = await findPossibleDuplicateId(
    db,
    companyId,
    identity,
    existing.id,
  )
  const lifecycleDates = leadLifecycleDates(status, now)

  const lead = await db.lead.update({
    where: { id: existing.id },
    data: {
      clientId: serviceRequest.clientId,
      ownerId,
      possibleDuplicateOfId,
      contactName: serviceRequest.customerName,
      email: serviceRequest.customerEmail,
      phone: serviceRequest.customerPhone,
      companyName: serviceRequest.customerCompany,
      serviceType: serviceRequest.serviceType,
      status,
      source: leadSourceFromServiceRequest(serviceRequest.source),
      priority: serviceRequest.priority,
      completionScore: leadCompletionScore({
        contactName: serviceRequest.customerName,
        email: serviceRequest.customerEmail,
        phone: serviceRequest.customerPhone,
        companyName: serviceRequest.customerCompany,
        serviceType: serviceRequest.serviceType,
        message: serviceRequest.message,
        budgetRange: serviceRequest.budgetRange,
        timeline: serviceRequest.timeline,
        contactConsent: existing.contactConsent,
      }),
      notes: serviceRequest.message,
      ...identity,
      qualifiedAt: existing.qualifiedAt ?? lifecycleDates.qualifiedAt,
      disqualifiedAt:
        existing.disqualifiedAt ?? lifecycleDates.disqualifiedAt,
      convertedAt: existing.convertedAt ?? lifecycleDates.convertedAt,
      archivedAt: existing.archivedAt ?? lifecycleDates.archivedAt,
    },
  })

  await db.activityLog.create({
    data: {
      companyId,
      userId: actorUserId ?? null,
      action:
        existing.status === lead.status
          ? ActivityAction.LEAD_UPDATED
          : ActivityAction.LEAD_STATUS_CHANGED,
      entityType: "Lead",
      entityId: lead.id,
      message:
        existing.status === lead.status
          ? `تم تحديث العميل المحتمل: ${lead.contactName}`
          : `تم تغيير حالة العميل المحتمل إلى ${lead.status}: ${lead.contactName}`,
      metadata: {
        serviceRequestId: serviceRequest.id,
        previousStatus: existing.status,
        status: lead.status,
        ownerId: lead.ownerId,
        completionScore: lead.completionScore,
        possibleDuplicateOfId,
      },
    },
  })

  return {
    lead,
    replayed: false,
  }
}

export async function createLeadForServiceRequest({
  db,
  companyId,
  serviceRequest,
  campaign,
  contactConsent,
  actorUserId,
  now = new Date(),
}: {
  db: DatabaseClient
  companyId: string
  serviceRequest: LeadServiceRequest
  campaign?: string | null
  contactConsent?: boolean | null
  actorUserId?: string | null
  now?: Date
}) {
  const existing = await db.lead.findUnique({
    where: { serviceRequestId: serviceRequest.id },
  })

  if (existing) {
    return {
      lead: existing,
      replayed: true,
    }
  }

  const identity = leadIdentity({
    email: serviceRequest.customerEmail,
    phone: serviceRequest.customerPhone,
    companyName: serviceRequest.customerCompany,
  })
  const status = leadStatusFromServiceRequest(serviceRequest.status)
  const ownerId = await resolveLeadOwnerId(
    db,
    companyId,
    serviceRequest.assignedToId,
  )
  const possibleDuplicateOfId = await findPossibleDuplicateId(
    db,
    companyId,
    identity,
  )

  const lead = await db.lead.create({
    data: {
      companyId,
      serviceRequestId: serviceRequest.id,
      clientId: serviceRequest.clientId,
      ownerId,
      possibleDuplicateOfId,
      contactName: serviceRequest.customerName,
      email: serviceRequest.customerEmail,
      phone: serviceRequest.customerPhone,
      companyName: serviceRequest.customerCompany,
      serviceType: serviceRequest.serviceType,
      status,
      source: leadSourceFromServiceRequest(serviceRequest.source),
      priority: serviceRequest.priority,
      campaign: campaign?.trim() || null,
      completionScore: leadCompletionScore({
        contactName: serviceRequest.customerName,
        email: serviceRequest.customerEmail,
        phone: serviceRequest.customerPhone,
        companyName: serviceRequest.customerCompany,
        serviceType: serviceRequest.serviceType,
        message: serviceRequest.message,
        budgetRange: serviceRequest.budgetRange,
        timeline: serviceRequest.timeline,
        contactConsent,
      }),
      contactConsent: contactConsent ?? null,
      contactConsentAt:
        contactConsent === true || contactConsent === false ? now : null,
      notes: serviceRequest.message,
      ...identity,
      ...leadLifecycleDates(status, now),
    },
  })

  await db.activityLog.create({
    data: {
      companyId,
      userId: actorUserId ?? null,
      action: ActivityAction.LEAD_CREATED,
      entityType: "Lead",
      entityId: lead.id,
      message: `تم تسجيل عميل محتمل جديد: ${lead.contactName}`,
      metadata: {
        serviceRequestId: serviceRequest.id,
        source: lead.source,
        ownerId: lead.ownerId,
        completionScore: lead.completionScore,
        possibleDuplicateOfId,
      },
    },
  })

  return {
    lead,
    replayed: false,
  }
}
