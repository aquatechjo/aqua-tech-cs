import { z } from "zod"

import {
  ActivityAction,
  LeadSource,
  LeadStatus,
  ServiceRequestPriority,
} from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  leadCompletionScore,
  leadIdentity,
  leadLifecycleDates,
} from "@/lib/crm-lead"
import {
  assertLeadOwner,
  findPossibleDuplicateId,
  nullableLeadText,
  optionalLeadDate,
  resolveLeadOwnerId,
} from "@/lib/crm-lead-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const createLeadSchema = z.object({
  contactName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(80).optional().nullable(),
  companyName: z.string().trim().max(250).optional().nullable(),
  serviceType: z.string().trim().min(2).max(200),
  source: z.nativeEnum(LeadSource).optional().default("MANUAL"),
  priority: z.nativeEnum(ServiceRequestPriority).optional().default("MEDIUM"),
  campaign: z.string().trim().max(200).optional().nullable(),
  ownerId: z.string().trim().optional().nullable(),
  contactConsent: z.boolean().optional().nullable(),
  nextAction: z.string().trim().max(500).optional().nullable(),
  nextActionAt: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
})

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.salesRead)

    const url = new URL(request.url)
    const q = url.searchParams.get("q")?.trim() ?? ""
    const ownerId = url.searchParams.get("ownerId")?.trim() ?? ""
    const statusValue = url.searchParams.get("status")
    const sourceValue = url.searchParams.get("source")
    const status = Object.values(LeadStatus).includes(
      statusValue as LeadStatus,
    )
      ? (statusValue as LeadStatus)
      : undefined
    const source = Object.values(LeadSource).includes(
      sourceValue as LeadSource,
    )
      ? (sourceValue as LeadSource)
      : undefined

    const leads = await prisma.lead.findMany({
      where: {
        companyId: user.companyId,
        ...(status ? { status } : {}),
        ...(source ? { source } : {}),
        ...(ownerId ? { ownerId } : {}),
        ...(q
          ? {
              OR: [
                { contactName: { contains: q, mode: "insensitive" } },
                { companyName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
                { serviceType: { contains: q, mode: "insensitive" } },
                { campaign: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ nextActionAt: "asc" }, { createdAt: "desc" }],
      take: 300,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        possibleDuplicateOf: {
          select: {
            id: true,
            contactName: true,
            companyName: true,
            email: true,
            phone: true,
          },
        },
        opportunity: { select: { id: true, title: true, stage: true } },
        serviceRequest: {
          select: { id: true, customerName: true, status: true },
        },
      },
    })

    return ok({ leads })
  } catch (error) {
    return handleApiError(error, "LEADS_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.salesManagement,
      "لا تملك صلاحية إضافة العملاء المحتملين",
    )

    const parsed = createLeadSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ?? "بيانات العميل المحتمل غير صحيحة",
        400,
        parsed.error.flatten(),
      )
    }

    const data = parsed.data
    const nextActionAt = optionalLeadDate(data.nextActionAt)

    if (nextActionAt && !nullableLeadText(data.nextAction)) {
      throw new ApiError(
        "اكتب الإجراء التالي عند تحديد موعد له",
        400,
        "LEAD_NEXT_ACTION_REQUIRED",
      )
    }

    const meta = await getRequestMeta()
    const now = new Date()

    const lead = await prisma.$transaction(async (tx) => {
      const requestedOwnerId = data.ownerId || null
      await assertLeadOwner(tx, user.companyId, requestedOwnerId)
      const ownerId =
        requestedOwnerId ??
        (await resolveLeadOwnerId(tx, user.companyId, user.id))
      const identity = leadIdentity({
        email: data.email,
        phone: data.phone,
        companyName: data.companyName,
      })
      const possibleDuplicateOfId = await findPossibleDuplicateId(
        tx,
        user.companyId,
        identity,
      )

      const created = await tx.lead.create({
        data: {
          companyId: user.companyId,
          ownerId,
          possibleDuplicateOfId,
          contactName: data.contactName,
          email: nullableLeadText(data.email),
          phone: nullableLeadText(data.phone),
          companyName: nullableLeadText(data.companyName),
          serviceType: data.serviceType,
          status: "NEW",
          source: data.source,
          priority: data.priority,
          campaign: nullableLeadText(data.campaign),
          completionScore: leadCompletionScore({
            contactName: data.contactName,
            email: data.email,
            phone: data.phone,
            companyName: data.companyName,
            serviceType: data.serviceType,
            message: data.notes,
            contactConsent: data.contactConsent,
          }),
          contactConsent: data.contactConsent ?? null,
          contactConsentAt:
            data.contactConsent === null ||
            data.contactConsent === undefined
              ? null
              : now,
          nextAction: nullableLeadText(data.nextAction),
          nextActionAt,
          notes: nullableLeadText(data.notes),
          ...identity,
          ...leadLifecycleDates("NEW", now),
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.LEAD_CREATED,
        entityType: "Lead",
        entityId: created.id,
        message: `تمت إضافة عميل محتمل يدويًا: ${created.contactName}`,
        metadata: {
          source: created.source,
          ownerId: created.ownerId,
          completionScore: created.completionScore,
          possibleDuplicateOfId,
        },
        ...meta,
      })

      return created
    })

    return ok({ lead }, 201)
  } catch (error) {
    return handleApiError(
      error,
      "LEADS_POST_ERROR",
      "تعذر إضافة العميل المحتمل",
    )
  }
}
