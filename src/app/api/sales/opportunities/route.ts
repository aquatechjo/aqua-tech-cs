import { z } from "zod"
import {
  ActivityAction,
  SalesOpportunityStage,
  ServiceRequestPriority,
  ServiceRequestSource,
} from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { defaultProbability, OPEN_SALES_STAGES } from "@/lib/sales"
import {
  assertSalesCurrency,
  assertSalesOwner,
  nullableSalesText,
  optionalSalesDate,
  resolveOpportunityLinks,
  salesValue,
} from "@/lib/sales-server"

const opportunityInputSchema = z.object({
  title: z.string().trim().min(2).max(250),
  contactName: z.string().trim().min(2).max(200),
  companyName: z.string().trim().max(250).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(80).optional().nullable(),
  serviceType: z.string().trim().min(2).max(200),
  stage: z.nativeEnum(SalesOpportunityStage).optional().default("NEW"),
  priority: z.nativeEnum(ServiceRequestPriority).optional().default("MEDIUM"),
  source: z.nativeEnum(ServiceRequestSource).optional().default("MANUAL"),
  estimatedValue: z.union([z.string(), z.number()]).optional().default("0"),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().trim().optional().nullable(),
  nextFollowUpAt: z.string().trim().optional().nullable(),
  ownerId: z.string().trim().optional().nullable(),
  clientId: z.string().trim().optional().nullable(),
  serviceRequestId: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
})

function serializeOpportunity(opportunity: {
  id: string
  title: string
  contactName: string
  companyName: string | null
  email: string | null
  phone: string | null
  serviceType: string
  stage: SalesOpportunityStage
  priority: ServiceRequestPriority
  source: ServiceRequestSource
  estimatedValue: { toString(): string }
  currency: string
  probability: number
  expectedCloseDate: Date | null
  nextFollowUpAt: Date | null
  lastContactAt: Date | null
  lostReason: string | null
  notes: string | null
  wonAt: Date | null
  lostAt: Date | null
  client: { id: string; name: string } | null
  project: { id: string; name: string; code: string | null } | null
  serviceRequest: { id: string; customerName: string; status: string } | null
  owner: { id: string; name: string; email: string } | null
  _count: { activities: number; proposals: number }
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...opportunity,
    estimatedValue: opportunity.estimatedValue.toString(),
    expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
    nextFollowUpAt: opportunity.nextFollowUpAt?.toISOString() ?? null,
    lastContactAt: opportunity.lastContactAt?.toISOString() ?? null,
    wonAt: opportunity.wonAt?.toISOString() ?? null,
    lostAt: opportunity.lostAt?.toISOString() ?? null,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.salesRead)

    const url = new URL(request.url)
    const q = url.searchParams.get("q")?.trim()
    const ownerId = url.searchParams.get("ownerId")?.trim()
    const stageValue = url.searchParams.get("stage")
    const allStages = [...OPEN_SALES_STAGES, "WON", "LOST"] as const
    const stage = allStages.includes(stageValue as (typeof allStages)[number])
      ? (stageValue as SalesOpportunityStage)
      : null

    const opportunities = await prisma.salesOpportunity.findMany({
      where: {
        companyId: user.companyId,
        ...(stage ? { stage } : {}),
        ...(ownerId ? { ownerId } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { contactName: { contains: q, mode: "insensitive" } },
                { companyName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
                { serviceType: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ stage: "asc" }, { updatedAt: "desc" }],
      take: 300,
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, code: true } },
        serviceRequest: { select: { id: true, customerName: true, status: true } },
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { activities: true, proposals: true } },
      },
    })

    return ok({
      opportunities: opportunities.map(serializeOpportunity),
    })
  } catch (error) {
    return handleApiError(error, "SALES_OPPORTUNITIES_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.salesManagement)

    const parsed = opportunityInputSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات الفرصة غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    if (parsed.data.stage === "WON" || parsed.data.stage === "LOST") {
      throw new ApiError(
        "أنشئ الفرصة كفرصة مفتوحة ثم استخدم مسار الفوز أو الخسارة",
        400,
        "TERMINAL_STAGE_NOT_ALLOWED_ON_CREATE",
      )
    }

    const expectedCloseDate = optionalSalesDate(parsed.data.expectedCloseDate)
    const nextFollowUpAt = optionalSalesDate(parsed.data.nextFollowUpAt)
    const value = salesValue(parsed.data.estimatedValue)
    const probability =
      parsed.data.probability ?? defaultProbability(parsed.data.stage)
    const meta = await getRequestMeta()

    const opportunity = await prisma.$transaction(async (tx) => {
      await assertSalesCurrency(
        tx,
        user.companyId,
        parsed.data.currency,
      )
      await assertSalesOwner(tx, user.companyId, parsed.data.ownerId)
      const links = await resolveOpportunityLinks({
        db: tx,
        companyId: user.companyId,
        clientId: parsed.data.clientId,
        serviceRequestId: parsed.data.serviceRequestId,
      })

      if (links.serviceRequestId) {
        const existing = await tx.salesOpportunity.findUnique({
          where: { serviceRequestId: links.serviceRequestId },
          select: { id: true },
        })

        if (existing) {
          throw new ApiError(
            "طلب الخدمة مرتبط بفرصة بيع مسبقًا",
            409,
            "SERVICE_REQUEST_OPPORTUNITY_EXISTS",
          )
        }
      }

      const created = await tx.salesOpportunity.create({
        data: {
          companyId: user.companyId,
          serviceRequestId: links.serviceRequestId,
          clientId: links.clientId,
          ownerId: parsed.data.ownerId || null,
          title: parsed.data.title,
          contactName: parsed.data.contactName,
          companyName: nullableSalesText(parsed.data.companyName),
          email: nullableSalesText(parsed.data.email),
          phone: nullableSalesText(parsed.data.phone),
          serviceType: parsed.data.serviceType,
          stage: parsed.data.stage,
          priority: parsed.data.priority,
          source: parsed.data.source,
          estimatedValue: value,
          currency: parsed.data.currency,
          probability,
          expectedCloseDate,
          nextFollowUpAt,
          notes: nullableSalesText(parsed.data.notes),
        },
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, code: true } },
          serviceRequest: { select: { id: true, customerName: true, status: true } },
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { activities: true, proposals: true } },
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.SALES_OPPORTUNITY_CREATED,
        entityType: "SalesOpportunity",
        entityId: created.id,
        message: `تم إنشاء فرصة البيع: ${created.title}`,
        metadata: {
          stage: created.stage,
          estimatedValue: created.estimatedValue.toString(),
          currency: created.currency,
          ownerId: created.ownerId,
          serviceRequestId: created.serviceRequestId,
        },
        ...meta,
      })

      return created
    })

    return ok({ opportunity: serializeOpportunity(opportunity) }, 201)
  } catch (error) {
    return handleApiError(
      error,
      "SALES_OPPORTUNITIES_POST_ERROR",
      "تعذر إنشاء فرصة البيع",
    )
  }
}
