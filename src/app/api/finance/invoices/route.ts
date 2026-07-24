import { z } from "zod"
import { ActivityAction, type InvoiceStatus } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  businessDate,
  calculateInvoiceTotals,
  displayInvoiceStatus,
} from "@/lib/finance"
import {
  assertOperationalCurrency,
  decimalMinor,
  nextDocumentNumber,
  resolveInvoiceLinks,
} from "@/lib/finance-server"
import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const decimalInput = z.union([z.string(), z.number()])

const invoiceInputSchema = z.object({
  clientId: z.string().trim().optional().nullable(),
  projectId: z.string().trim().optional().nullable(),
  serviceRequestId: z.string().trim().optional().nullable(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("JOD"),
  issueDate: z.string().trim().optional().nullable(),
  dueDate: z.string().trim().optional().nullable(),
  discountAmount: decimalInput.optional().default("0"),
  taxAmount: decimalInput.optional().default("0"),
  notes: z.string().trim().max(4000).optional().nullable(),
  terms: z.string().trim().max(4000).optional().nullable(),
  issueImmediately: z.boolean().optional().default(false),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(300),
        quantity: decimalInput,
        unitPrice: decimalInput,
      }),
    )
    .min(1)
    .max(50),
})

function optionalDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ApiError("التاريخ المدخل غير صحيح", 400, "INVALID_DATE")
  }
  return date
}

function nullableText(value: string | null | undefined) {
  const text = value?.trim()
  return text || null
}

function calculationError(error: unknown): never {
  const code = error instanceof Error ? error.message : "INVALID_INVOICE_TOTALS"
  const messages: Record<string, string> = {
    INVALID_DECIMAL: "أحد المبالغ غير صحيح",
    TOO_MANY_DECIMALS: "المبالغ والكميات تقبل منزلتين عشريتين كحد أقصى",
    DECIMAL_OUT_OF_RANGE: "أحد المبالغ خارج النطاق المسموح",
    QUANTITY_MUST_BE_POSITIVE: "كمية البند يجب أن تكون أكبر من صفر",
    INVOICE_ITEMS_REQUIRED: "يجب إضافة بند واحد على الأقل",
    ITEM_DESCRIPTION_REQUIRED: "وصف بند الفاتورة مطلوب",
    DISCOUNT_EXCEEDS_SUBTOTAL: "الخصم لا يمكن أن يتجاوز المجموع الفرعي",
    INVOICE_TOTAL_MUST_BE_POSITIVE: "إجمالي الفاتورة يجب أن يكون أكبر من صفر",
  }

  throw new ApiError(messages[code] ?? "تعذر احتساب الفاتورة", 400, code)
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.financeRead)

    const url = new URL(request.url)
    const statusValue = url.searchParams.get("status")
    const invoiceStatuses: InvoiceStatus[] = [
      "DRAFT",
      "ISSUED",
      "PARTIALLY_PAID",
      "PAID",
      "CANCELLED",
    ]
    const status = invoiceStatuses.includes(statusValue as InvoiceStatus)
      ? (statusValue as InvoiceStatus)
      : null
    const projectId = url.searchParams.get("projectId")
    const clientId = url.searchParams.get("clientId")
    const q = url.searchParams.get("q")?.trim()

    const invoices = await prisma.invoice.findMany({
      where: {
        companyId: user.companyId,
        ...(status ? { status } : {}),
        ...(projectId ? { projectId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(q
          ? {
              OR: [
                { invoiceNumber: { contains: q, mode: "insensitive" } },
                { client: { name: { contains: q, mode: "insensitive" } } },
                { project: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true, payments: true } },
      },
    })

    return ok({
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        displayStatus: displayInvoiceStatus({
          status: invoice.status,
          dueDate: invoice.dueDate,
          totalMinor: decimalMinor(invoice.totalAmount),
          amountPaidMinor: decimalMinor(invoice.amountPaid),
          timeZone: user.company.timezone,
        }),
        currency: invoice.currency,
        issueDate: invoice.issueDate?.toISOString() ?? null,
        dueDate: invoice.dueDate?.toISOString() ?? null,
        subtotal: invoice.subtotal.toString(),
        discountAmount: invoice.discountAmount.toString(),
        taxAmount: invoice.taxAmount.toString(),
        totalAmount: invoice.totalAmount.toString(),
        amountPaid: invoice.amountPaid.toString(),
        client: invoice.client,
        project: invoice.project,
        itemCount: invoice._count.items,
        paymentCount: invoice._count.payments,
        createdAt: invoice.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    return handleApiError(error, "FINANCE_INVOICES_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.financeManagement)

    const parsed = invoiceInputSchema.safeParse(await readJsonBody(request, 128 * 1024))
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات الفاتورة غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    let totals: ReturnType<typeof calculateInvoiceTotals>
    try {
      totals = calculateInvoiceTotals(parsed.data)
    } catch (error) {
      calculationError(error)
    }

    const issueDate = parsed.data.issueImmediately
      ? optionalDate(parsed.data.issueDate) ??
        businessDate(new Date(), user.company.timezone)
      : optionalDate(parsed.data.issueDate)
    const dueDate = optionalDate(parsed.data.dueDate)

    if (issueDate && dueDate && dueDate.getTime() < issueDate.getTime()) {
      throw new ApiError(
        "تاريخ الاستحقاق لا يمكن أن يسبق تاريخ الإصدار",
        400,
        "DUE_DATE_BEFORE_ISSUE_DATE",
      )
    }

    const meta = await getRequestMeta()

    const invoice = await prisma.$transaction(async (tx) => {
      await assertOperationalCurrency(tx, user.companyId, parsed.data.currency)
      const links = await resolveInvoiceLinks({
        db: tx,
        companyId: user.companyId,
        clientId: parsed.data.clientId,
        projectId: parsed.data.projectId,
        serviceRequestId: parsed.data.serviceRequestId,
        currency: parsed.data.currency,
      })
      const invoiceNumber = await nextDocumentNumber(
        tx,
        user.companyId,
        "INV",
        issueDate ?? new Date(),
        user.company.timezone,
      )

      const created = await tx.invoice.create({
        data: {
          companyId: user.companyId,
          createdById: user.id,
          ...links,
          invoiceNumber,
          status: parsed.data.issueImmediately ? "ISSUED" : "DRAFT",
          currency: parsed.data.currency,
          issueDate,
          dueDate,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          amountPaid: "0.00",
          notes: nullableText(parsed.data.notes),
          terms: nullableText(parsed.data.terms),
          items: {
            create: totals.items.map((item) => ({
              companyId: user.companyId,
              ...item,
            })),
          },
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.INVOICE_CREATED,
        entityType: "Invoice",
        entityId: created.id,
        message: `تم إنشاء الفاتورة ${created.invoiceNumber}`,
        metadata: {
          invoiceNumber: created.invoiceNumber,
          totalAmount: created.totalAmount.toString(),
          currency: created.currency,
          status: created.status,
        },
        ...meta,
      })

      if (parsed.data.issueImmediately) {
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.INVOICE_ISSUED,
          entityType: "Invoice",
          entityId: created.id,
          message: `تم إصدار الفاتورة ${created.invoiceNumber}`,
          ...meta,
        })
      }

      return created
    })

    return ok(
      {
        invoice: {
          ...invoice,
          subtotal: invoice.subtotal.toString(),
          discountAmount: invoice.discountAmount.toString(),
          taxAmount: invoice.taxAmount.toString(),
          totalAmount: invoice.totalAmount.toString(),
          amountPaid: invoice.amountPaid.toString(),
          items: invoice.items.map((item) => ({
            ...item,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            lineTotal: item.lineTotal.toString(),
          })),
        },
      },
      201,
    )
  } catch (error) {
    return handleApiError(
      error,
      "FINANCE_INVOICES_POST_ERROR",
      "تعذر إنشاء الفاتورة",
    )
  }
}
