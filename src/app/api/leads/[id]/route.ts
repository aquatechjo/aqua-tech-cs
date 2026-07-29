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
  serviceRequestStatusFromLead,
} from "@/lib/crm-lead"
import {
  assertLeadOwner,
  findPossibleDuplicateId,
  nullableLeadText,
  optionalLeadDate,
} from "@/lib/crm-lead-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const updateLeadSchema = z
  .object({
    contactName: z.string().trim().min(2).max(200).optional(),
    email: z.string().trim().email().optional().nullable().or(z.literal("")),
    phone: z.string().trim().max(80).optional().nullable(),
    companyName: z.string().trim().max(250).optional().nullable(),
    serviceType: z.string().trim().min(2).max(200).optional(),
    status: z.nativeEnum(LeadStatus).optional(),
    source: z.nativeEnum(LeadSource).optional(),
    priority: z.nativeEnum(ServiceRequestPriority).optional(),
    campaign: z.string().trim().max(200).optional().nullable(),
    ownerId: z.string().trim().optional().nullable(),
    contactConsent: z.boolean().optional().nullable(),
    nextAction: z.string().trim().max(500).optional().nullable(),
    nextActionAt: z.string().trim().optional().nullable(),
    notes: z.string().trim().max(4000).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "لا توجد تعديلات للحفظ",
  })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.salesManagement,
      "لا تملك صلاحية تعديل العملاء المحتملين",
    )

    const parsed = updateLeadSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ?? "بيانات العميل المحتمل غير صحيحة",
        400,
        parsed.error.flatten(),
      )
    }

    if (parsed.data.status === "CONVERTED") {
      throw new ApiError(
        "تحويل العميل المحتمل يتم من مسار إنشاء فرصة البيع",
        409,
        "LEAD_CONVERSION_ROUTE_REQUIRED",
      )
    }

    const { id } = await params
    const data = parsed.data
    const meta = await getRequestMeta()
    const now = new Date()

    const lead = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Lead"
        WHERE "id" = ${id}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const existing = await tx.lead.findFirst({
        where: {
          id,
          companyId: user.companyId,
        },
        include: {
          opportunity: {
            select: { id: true },
          },
        },
      })

      if (!existing) {
        throw new ApiError(
          "العميل المحتمل غير موجود",
          404,
          "LEAD_NOT_FOUND",
        )
      }

      if (existing.status === "CONVERTED" || existing.opportunity) {
        throw new ApiError(
          "هذا العميل المحتمل مرتبط بفرصة بيع ولا يمكن تعديل مرحلة التأهيل منه",
          409,
          "LEAD_ALREADY_CONVERTED",
        )
      }

      const ownerId =
        data.ownerId === undefined ? existing.ownerId : data.ownerId || null
      await assertLeadOwner(tx, user.companyId, ownerId)

      const contactName = data.contactName ?? existing.contactName
      const email =
        data.email === undefined
          ? existing.email
          : nullableLeadText(data.email)
      const phone =
        data.phone === undefined
          ? existing.phone
          : nullableLeadText(data.phone)
      const companyName =
        data.companyName === undefined
          ? existing.companyName
          : nullableLeadText(data.companyName)
      const serviceType = data.serviceType ?? existing.serviceType
      const status = data.status ?? existing.status
      const source = data.source ?? existing.source
      const priority = data.priority ?? existing.priority
      const notes =
        data.notes === undefined
          ? existing.notes
          : nullableLeadText(data.notes)
      const contactConsent =
        data.contactConsent === undefined
          ? existing.contactConsent
          : data.contactConsent
      const nextAction =
        data.nextAction === undefined
          ? existing.nextAction
          : nullableLeadText(data.nextAction)
      const nextActionAt =
        data.nextActionAt === undefined
          ? existing.nextActionAt
          : optionalLeadDate(data.nextActionAt)

      if (nextActionAt && !nextAction) {
        throw new ApiError(
          "اكتب الإجراء التالي عند تحديد موعد له",
          400,
          "LEAD_NEXT_ACTION_REQUIRED",
        )
      }

      const identity = leadIdentity({
        email,
        phone,
        companyName,
      })
      const detectedDuplicateId = await findPossibleDuplicateId(
        tx,
        user.companyId,
        identity,
        existing.id,
      )
      const possibleDuplicateOfId =
        status === "DUPLICATE"
          ? existing.possibleDuplicateOfId ?? detectedDuplicateId
          : detectedDuplicateId

      if (status === "DUPLICATE" && !possibleDuplicateOfId) {
        throw new ApiError(
          "لا يوجد سجل مطابق يمكن اعتماد هذا العميل المحتمل كنسخة منه",
          409,
          "LEAD_DUPLICATE_TARGET_REQUIRED",
        )
      }

      const lifecycleDates = leadLifecycleDates(status, now)
      const updated = await tx.lead.update({
        where: { id: existing.id },
        data: {
          ownerId,
          possibleDuplicateOfId:
            status === "SPAM" ? null : possibleDuplicateOfId,
          contactName,
          email,
          phone,
          companyName,
          serviceType,
          status,
          source,
          priority,
          campaign:
            data.campaign === undefined
              ? existing.campaign
              : nullableLeadText(data.campaign),
          completionScore: leadCompletionScore({
            contactName,
            email,
            phone,
            companyName,
            serviceType,
            message: notes,
            contactConsent,
          }),
          contactConsent,
          contactConsentAt:
            data.contactConsent === undefined
              ? existing.contactConsentAt
              : data.contactConsent === existing.contactConsent
                ? existing.contactConsentAt
                : data.contactConsent === null
                  ? null
                  : now,
          nextAction,
          nextActionAt,
          notes,
          ...identity,
          qualifiedAt: existing.qualifiedAt ?? lifecycleDates.qualifiedAt,
          disqualifiedAt:
            existing.disqualifiedAt ?? lifecycleDates.disqualifiedAt,
          convertedAt: existing.convertedAt ?? lifecycleDates.convertedAt,
          archivedAt: existing.archivedAt ?? lifecycleDates.archivedAt,
        },
      })

      if (existing.serviceRequestId) {
        const serviceRequestStatus = serviceRequestStatusFromLead(status)

        await tx.serviceRequest.updateMany({
          where: {
            id: existing.serviceRequestId,
            companyId: user.companyId,
            status: { not: "CONVERTED" },
          },
          data: {
            assignedToId: ownerId,
            customerName: contactName,
            customerEmail: email,
            customerPhone: phone,
            customerCompany: companyName,
            serviceType,
            status: serviceRequestStatus,
            priority,
            ...(serviceRequestStatus === "REJECTED"
              ? { rejectedAt: now }
              : {}),
          },
        })
      }

      const statusChanged = existing.status !== updated.status

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: statusChanged
          ? ActivityAction.LEAD_STATUS_CHANGED
          : ActivityAction.LEAD_UPDATED,
        entityType: "Lead",
        entityId: updated.id,
        message: statusChanged
          ? `تم تغيير حالة العميل المحتمل إلى ${updated.status}: ${updated.contactName}`
          : `تم تحديث العميل المحتمل: ${updated.contactName}`,
        metadata: {
          previousStatus: existing.status,
          status: updated.status,
          ownerId: updated.ownerId,
          completionScore: updated.completionScore,
          possibleDuplicateOfId: updated.possibleDuplicateOfId,
          serviceRequestId: updated.serviceRequestId,
        },
        ...meta,
      })

      return updated
    })

    return ok({ lead })
  } catch (error) {
    return handleApiError(
      error,
      "LEAD_PATCH_ERROR",
      "تعذر تعديل العميل المحتمل",
    )
  }
}
