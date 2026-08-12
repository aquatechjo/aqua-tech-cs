import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  businessDate,
  calculateInvoiceTotals,
  displayInvoiceStatus,
} from "@/lib/finance"
import {
  assertOperationalCurrency,
  decimalMinor,
  resolveInvoiceLinks,
} from "@/lib/finance-server"
import { prisma } from "@/lib/prisma"
import {
  AMENDMENT_INVOICE_TAX_DECISIONS,
  amendmentInvoiceEditIssues,
  amendmentInvoiceIssuanceIssues,
} from "@/lib/project-amendment-invoice-issuance"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const decimalInput = z.union([z.string(), z.number()])

const patchSchema = z.object({
  action: z.enum(["UPDATE", "ISSUE", "CANCEL"]).default("UPDATE"),
  clientId: z.string().trim().optional().nullable(),
  projectId: z.string().trim().optional().nullable(),
  serviceRequestId: z.string().trim().optional().nullable(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  issueDate: z.string().trim().optional().nullable(),
  dueDate: z.string().trim().optional().nullable(),
  discountAmount: decimalInput.optional(),
  taxAmount: decimalInput.optional(),
  notes: z.string().trim().max(4000).optional().nullable(),
  terms: z.string().trim().max(4000).optional().nullable(),
  reason: z.string().trim().max(1000).optional().nullable(),
  issueReference: z.string().trim().min(3).max(200).optional(),
  taxDecision: z.enum(AMENDMENT_INVOICE_TAX_DECISIONS).optional(),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(300),
        quantity: decimalInput,
        unitPrice: decimalInput,
      }),
    )
    .min(1)
    .max(50)
    .optional(),
})

function optionalDate(value: string | null | undefined) {
  if (value === undefined) return undefined
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ApiError("التاريخ المدخل غير صحيح", 400, "INVALID_DATE")
  }
  return date
}

function nullableText(value: string | null | undefined) {
  if (value === undefined) return undefined
  const text = value?.trim()
  return text || null
}

function serializeInvoice(
  invoice: Awaited<ReturnType<typeof loadInvoice>>,
  timeZone: string,
) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    displayStatus: displayInvoiceStatus({
      status: invoice.status,
      dueDate: invoice.dueDate,
      totalMinor: decimalMinor(invoice.totalAmount),
      amountPaidMinor: decimalMinor(invoice.amountPaid),
      timeZone,
    }),
    currency: invoice.currency,
    issueDate: invoice.issueDate?.toISOString() ?? null,
    dueDate: invoice.dueDate?.toISOString() ?? null,
    subtotal: invoice.subtotal.toString(),
    discountAmount: invoice.discountAmount.toString(),
    taxAmount: invoice.taxAmount.toString(),
    totalAmount: invoice.totalAmount.toString(),
    amountPaid: invoice.amountPaid.toString(),
    notes: invoice.notes,
    terms: invoice.terms,
    client: invoice.client,
    project: invoice.project,
    serviceRequest: invoice.serviceRequest,
    createdBy: invoice.createdBy,
    contractAmendment: invoice.contractAmendment
      ? {
          id: invoice.contractAmendment.id,
          amendmentNumber: invoice.contractAmendment.amendmentNumber,
          financialAmount: invoice.contractAmendment.financialAmountSnapshot.toString(),
          invoiceIssuedAt: invoice.contractAmendment.invoiceIssuedAt?.toISOString() ?? null,
          invoiceIssueReference: invoice.contractAmendment.invoiceIssueReference,
          invoiceTaxDecision: invoice.contractAmendment.invoiceTaxDecision,
        }
      : null,
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
      sortOrder: item.sortOrder,
    })),
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount.toString(),
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      reference: payment.reference,
      notes: payment.notes,
      paidAt: payment.paidAt.toISOString(),
      reversedAt: payment.reversedAt?.toISOString() ?? null,
      reversalReason: payment.reversalReason,
      recordedBy: payment.recordedBy,
      reversedBy: payment.reversedBy,
      createdAt: payment.createdAt.toISOString(),
    })),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  }
}

function loadInvoice(companyId: string, id: string) {
  return prisma.invoice.findFirstOrThrow({
    where: { id, companyId },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      project: { select: { id: true, name: true, code: true } },
      serviceRequest: { select: { id: true, customerName: true, serviceType: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      contractAmendment: true,
      items: { orderBy: { sortOrder: "asc" } },
      payments: {
        orderBy: { paidAt: "desc" },
        include: {
          recordedBy: { select: { id: true, name: true } },
          reversedBy: { select: { id: true, name: true } },
        },
      },
    },
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.financeRead)
    const { id } = await params

    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        project: { select: { id: true, name: true, code: true } },
        serviceRequest: { select: { id: true, customerName: true, serviceType: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        contractAmendment: true,
        items: { orderBy: { sortOrder: "asc" } },
        payments: {
          orderBy: { paidAt: "desc" },
          include: {
            recordedBy: { select: { id: true, name: true } },
            reversedBy: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!invoice) {
      throw new ApiError("الفاتورة غير موجودة", 404, "INVOICE_NOT_FOUND")
    }

    return ok({ invoice: serializeInvoice(invoice, user.company.timezone) })
  } catch (error) {
    return handleApiError(error, "FINANCE_INVOICE_GET_ERROR")
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.financeManagement)
    const { id } = await params

    const parsed = patchSchema.safeParse(await readJsonBody(request, 128 * 1024))
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات الفاتورة غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    const existing = await prisma.invoice.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        payments: { where: { status: "POSTED" }, select: { id: true } },
        items: { orderBy: { sortOrder: "asc" } },
        contractAmendment: {
          include: {
            project: { select: { id: true, clientId: true } },
          },
        },
      },
    })

    if (!existing) {
      throw new ApiError("الفاتورة غير موجودة", 404, "INVOICE_NOT_FOUND")
    }

    const meta = await getRequestMeta()
    const data = parsed.data

    await prisma.$transaction(async (tx) => {
      if (data.action === "ISSUE") {
        if (existing.status !== "DRAFT") {
          throw new ApiError("يمكن إصدار مسودة فقط", 409, "INVOICE_NOT_DRAFT")
        }

        const issueDate =
          optionalDate(data.issueDate) ??
          existing.issueDate ??
          businessDate(new Date(), user.company.timezone)
        const dueDate = optionalDate(data.dueDate) ?? existing.dueDate
        if (dueDate && dueDate.getTime() < issueDate.getTime()) {
          throw new ApiError(
            "تاريخ الاستحقاق لا يمكن أن يسبق تاريخ الإصدار",
            400,
            "DUE_DATE_BEFORE_ISSUE_DATE",
          )
        }

        if (existing.contractAmendment) {
          await tx.$queryRaw`
            SELECT "id" FROM "Invoice"
            WHERE "id" = ${existing.id} AND "companyId" = ${user.companyId}
            FOR UPDATE
          `
          await tx.$queryRaw`
            SELECT "id" FROM "ProjectContractAmendment"
            WHERE "id" = ${existing.contractAmendment.id}
              AND "companyId" = ${user.companyId}
            FOR UPDATE
          `
          const lockedInvoice = await tx.invoice.findFirst({
            where: { id: existing.id, companyId: user.companyId },
            include: {
              items: { orderBy: { sortOrder: "asc" } },
              contractAmendment: {
                include: {
                  project: { select: { id: true, clientId: true } },
                },
              },
            },
          })
          const lockedAmendment = lockedInvoice?.contractAmendment
          if (!lockedInvoice || !lockedAmendment) {
            throw new ApiError(
              "تعذر تثبيت ربط فاتورة الملحق",
              409,
              "PROJECT_AMENDMENT_INVOICE_LINK_MISSING",
            )
          }
          if (lockedInvoice.status !== "DRAFT" || lockedAmendment.invoiceIssuedAt) {
            throw new ApiError(
              "تم إصدار فاتورة الملحق مسبقًا",
              409,
              "PROJECT_AMENDMENT_INVOICE_ALREADY_ISSUED",
            )
          }
          const issues = amendmentInvoiceIssuanceIssues({
            reference: data.issueReference,
            dueDate,
            taxDecision: data.taxDecision,
            taxAmount: lockedInvoice.taxAmount.toString(),
            subtotal: lockedInvoice.subtotal.toString(),
            discountAmount: lockedInvoice.discountAmount.toString(),
            amendmentAmount: lockedAmendment.financialAmountSnapshot.toString(),
            currency: lockedInvoice.currency,
            amendmentCurrency: lockedAmendment.financialCurrencySnapshot,
            projectId: lockedInvoice.projectId,
            amendmentProjectId: lockedAmendment.projectId,
            clientId: lockedInvoice.clientId,
            projectClientId: lockedAmendment.project.clientId,
            items: lockedInvoice.items.map((item) => ({
              quantity: item.quantity.toString(),
              unitPrice: item.unitPrice.toString(),
            })),
          })
          if (issues.length) {
            throw new ApiError(
              issues[0],
              409,
              "PROJECT_AMENDMENT_INVOICE_ISSUANCE_BLOCKED",
            )
          }
        }

        await tx.invoice.update({
          where: { id: existing.id },
          data: { status: "ISSUED", issueDate, dueDate },
        })
        if (existing.contractAmendment) {
          await tx.projectContractAmendment.update({
            where: { id: existing.contractAmendment.id },
            data: {
              invoiceIssuedById: user.id,
              invoiceIssuedAt: new Date(),
              invoiceIssueReference: data.issueReference!,
              invoiceTaxDecision: data.taxDecision!,
            },
          })
          await logActivity({
            db: tx,
            companyId: user.companyId,
            userId: user.id,
            action: ActivityAction.PROJECT_AMENDMENT_INVOICE_ISSUED,
            entityType: "ProjectContractAmendment",
            entityId: existing.contractAmendment.id,
            message: `تم إصدار فاتورة الملحق ${existing.invoiceNumber}`,
            metadata: {
              invoiceId: existing.id,
              invoiceNumber: existing.invoiceNumber,
              amendmentNumber: existing.contractAmendment.amendmentNumber,
              issueReference: data.issueReference,
              taxDecision: data.taxDecision,
              dueDate: dueDate!.toISOString(),
            },
            ...meta,
          })
        }
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.INVOICE_ISSUED,
          entityType: "Invoice",
          entityId: existing.id,
          message: `تم إصدار الفاتورة ${existing.invoiceNumber}`,
          ...meta,
        })
        return
      }

      if (data.action === "CANCEL") {
        if (existing.status === "CANCELLED") return
        if (existing.status === "PAID" || existing.payments.length > 0) {
          throw new ApiError(
            "لا يمكن إلغاء فاتورة تحتوي على دفعات؛ اعكس الدفعات أولًا",
            409,
            "INVOICE_HAS_PAYMENTS",
          )
        }

        await tx.invoice.update({
          where: { id: existing.id },
          data: {
            status: "CANCELLED",
            notes: data.reason
              ? [existing.notes, `سبب الإلغاء: ${data.reason}`].filter(Boolean).join("\n")
              : existing.notes,
          },
        })
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.INVOICE_CANCELLED,
          entityType: "Invoice",
          entityId: existing.id,
          message: `تم إلغاء الفاتورة ${existing.invoiceNumber}`,
          metadata: { reason: data.reason ?? null },
          ...meta,
        })
        return
      }

      const financialFieldsRequested =
        data.items !== undefined ||
        data.discountAmount !== undefined ||
        data.taxAmount !== undefined ||
        data.currency !== undefined ||
        data.clientId !== undefined ||
        data.projectId !== undefined ||
        data.serviceRequestId !== undefined

      if (existing.contractAmendment && data.action === "UPDATE") {
        const issues = amendmentInvoiceEditIssues({
          itemsRequested: data.items !== undefined,
          discountRequested: data.discountAmount !== undefined,
          linksRequested:
            data.currency !== undefined ||
            data.clientId !== undefined ||
            data.projectId !== undefined ||
            data.serviceRequestId !== undefined,
        })
        if (issues.length) {
          throw new ApiError(
            issues[0],
            409,
            "PROJECT_AMENDMENT_INVOICE_IMMUTABLE_BASE",
          )
        }
      }

      if (existing.status !== "DRAFT" && financialFieldsRequested) {
        throw new ApiError(
          "بنود وربط ومبالغ الفاتورة لا تعدّل بعد الإصدار",
          409,
          "ISSUED_INVOICE_FINANCIALS_LOCKED",
        )
      }

      let totals:
        | ReturnType<typeof calculateInvoiceTotals>
        | undefined

      if (data.items) {
        try {
          totals = calculateInvoiceTotals({
            items: data.items,
            discountAmount: data.discountAmount ?? existing.discountAmount.toString(),
            taxAmount: data.taxAmount ?? existing.taxAmount.toString(),
          })
        } catch (error) {
          throw new ApiError(
            "تعذر احتساب بنود الفاتورة؛ تحقق من الكميات والمبالغ والخصم",
            400,
            error instanceof Error ? error.message : "INVALID_INVOICE_TOTALS",
          )
        }
      } else if (data.discountAmount !== undefined || data.taxAmount !== undefined) {
        const currentItems = await tx.invoiceItem.findMany({
          where: { invoiceId: existing.id, companyId: user.companyId },
          orderBy: { sortOrder: "asc" },
        })
        try {
          totals = calculateInvoiceTotals({
            items: currentItems.map((item) => ({
              description: item.description,
              quantity: item.quantity.toString(),
              unitPrice: item.unitPrice.toString(),
            })),
            discountAmount:
              data.discountAmount ?? existing.discountAmount.toString(),
            taxAmount: data.taxAmount ?? existing.taxAmount.toString(),
          })
        } catch (error) {
          throw new ApiError(
            "تعذر احتساب الفاتورة؛ تحقق من الخصم والضريبة",
            400,
            error instanceof Error ? error.message : "INVALID_INVOICE_TOTALS",
          )
        }
      }

      const effectiveCurrency = data.currency ?? existing.currency
      if (financialFieldsRequested) {
        await assertOperationalCurrency(tx, user.companyId, effectiveCurrency)
      }

      const links = financialFieldsRequested
        ? await resolveInvoiceLinks({
            db: tx,
            companyId: user.companyId,
            clientId: data.clientId === undefined ? existing.clientId : data.clientId,
            projectId: data.projectId === undefined ? existing.projectId : data.projectId,
            serviceRequestId:
              data.serviceRequestId === undefined
                ? existing.serviceRequestId
                : data.serviceRequestId,
            currency: effectiveCurrency,
          })
        : undefined

      const issueDate = optionalDate(data.issueDate)
      const dueDate = optionalDate(data.dueDate)
      const effectiveIssueDate = issueDate === undefined ? existing.issueDate : issueDate
      const effectiveDueDate = dueDate === undefined ? existing.dueDate : dueDate
      if (
        effectiveIssueDate &&
        effectiveDueDate &&
        effectiveDueDate.getTime() < effectiveIssueDate.getTime()
      ) {
        throw new ApiError(
          "تاريخ الاستحقاق لا يمكن أن يسبق تاريخ الإصدار",
          400,
          "DUE_DATE_BEFORE_ISSUE_DATE",
        )
      }

      await tx.invoice.update({
        where: { id: existing.id },
        data: {
          ...(links ?? {}),
          ...(data.currency !== undefined ? { currency: data.currency } : {}),
          ...(issueDate !== undefined ? { issueDate } : {}),
          ...(dueDate !== undefined ? { dueDate } : {}),
          ...(nullableText(data.notes) !== undefined ? { notes: nullableText(data.notes) } : {}),
          ...(nullableText(data.terms) !== undefined ? { terms: nullableText(data.terms) } : {}),
          ...(totals
            ? {
                subtotal: totals.subtotal,
                discountAmount: totals.discountAmount,
                taxAmount: totals.taxAmount,
                totalAmount: totals.totalAmount,
              }
            : {}),
        },
      })

      if (totals && data.items) {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: existing.id, companyId: user.companyId },
        })
        await tx.invoiceItem.createMany({
          data: totals.items.map((item) => ({
            companyId: user.companyId,
            invoiceId: existing.id,
            ...item,
          })),
        })
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.INVOICE_UPDATED,
        entityType: "Invoice",
        entityId: existing.id,
        message: `تم تحديث الفاتورة ${existing.invoiceNumber}`,
        ...meta,
      })
    })

    const updated = await loadInvoice(user.companyId, id)
    return ok({
      invoice: serializeInvoice(updated, user.company.timezone),
    })
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      return handleApiError(
        new ApiError("الفاتورة غير موجودة", 404, "INVOICE_NOT_FOUND"),
        "FINANCE_INVOICE_PATCH_NOT_FOUND",
      )
    }

    return handleApiError(
      error,
      "FINANCE_INVOICE_PATCH_ERROR",
      "تعذر تحديث الفاتورة",
    )
  }
}
