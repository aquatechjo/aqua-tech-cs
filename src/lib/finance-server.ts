import "server-only"

import { randomUUID } from "node:crypto"
import type { Prisma } from "@/generated/prisma/client"
import type { InvoiceStatus } from "@/generated/prisma/enums"
import { ApiError } from "@/lib/api-response"
import {
  documentNumber,
  localDateKey,
  minorToMoney,
  parseScaledDecimal,
  paymentAdjustedInvoiceStatus,
} from "@/lib/finance"
import { prisma } from "@/lib/prisma"

type DatabaseClient = Prisma.TransactionClient | typeof prisma

type DecimalLike = {
  toString(): string
}

export function decimalMinor(value: DecimalLike | string | number | null | undefined) {
  return parseScaledDecimal(value?.toString() ?? "0")
}


export async function assertOperationalCurrency(
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
      `المالية التشغيلية تستخدم عملة الشركة ${company.currency} فقط`,
      400,
      "OPERATIONAL_CURRENCY_MISMATCH",
    )
  }

  return company.currency
}

export async function nextDocumentNumber(
  db: DatabaseClient,
  companyId: string,
  prefix: "INV" | "EXP" | "PROP" | "CR" | "RSK" | "ISS" | "DEC",
  date = new Date(),
  timeZone = "Asia/Amman",
) {
  const year = Number(localDateKey(date, timeZone).slice(0, 4))
  const key = `${prefix}-${year}`

  const rows = await db.$queryRaw<Array<{ currentValue: number }>>`
    INSERT INTO "DocumentSequence" (
      "id",
      "companyId",
      "key",
      "currentValue",
      "createdAt",
      "updatedAt"
    )
    VALUES (${randomUUID()}, ${companyId}, ${key}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("companyId", "key")
    DO UPDATE SET
      "currentValue" = "DocumentSequence"."currentValue" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "currentValue"
  `

  const currentValue = rows[0]?.currentValue
  if (!currentValue) {
    throw new ApiError(
      "تعذر إنشاء الرقم التسلسلي للمستند",
      500,
      "DOCUMENT_SEQUENCE_ERROR",
    )
  }

  return documentNumber(prefix, year, currentValue)
}

export async function refreshInvoicePaymentState(
  db: DatabaseClient,
  companyId: string,
  invoiceId: string,
) {
  const invoice = await db.invoice.findFirst({
    where: {
      id: invoiceId,
      companyId,
    },
    select: {
      id: true,
      status: true,
      totalAmount: true,
    },
  })

  if (!invoice) {
    throw new ApiError("الفاتورة غير موجودة", 404, "INVOICE_NOT_FOUND")
  }

  const payments = await db.payment.aggregate({
    where: {
      companyId,
      invoiceId,
      status: "POSTED",
    },
    _sum: {
      amount: true,
    },
  })

  const totalMinor = decimalMinor(invoice.totalAmount)
  const amountPaidMinor = decimalMinor(payments._sum.amount)
  const status = paymentAdjustedInvoiceStatus({
    currentStatus: invoice.status as InvoiceStatus,
    totalMinor,
    amountPaidMinor,
  })

  return db.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: minorToMoney(amountPaidMinor),
      status,
    },
  })
}

export async function resolveInvoiceLinks({
  db,
  companyId,
  clientId,
  projectId,
  serviceRequestId,
  currency,
}: {
  db: DatabaseClient
  companyId: string
  clientId?: string | null
  projectId?: string | null
  serviceRequestId?: string | null
  currency?: string
}) {
  let resolvedClientId = clientId || null
  let resolvedProjectId = projectId || null
  const resolvedServiceRequestId = serviceRequestId || null

  if (resolvedClientId) {
    const client = await db.client.findFirst({
      where: { id: resolvedClientId, companyId },
      select: { id: true },
    })

    if (!client) {
      throw new ApiError("العميل المحدد غير موجود", 404, "CLIENT_NOT_FOUND")
    }
  }

  if (resolvedProjectId) {
    const project = await db.project.findFirst({
      where: { id: resolvedProjectId, companyId },
      select: { id: true, clientId: true },
    })

    if (!project) {
      throw new ApiError("المشروع المحدد غير موجود", 404, "PROJECT_NOT_FOUND")
    }

    if (resolvedClientId && project.clientId && project.clientId !== resolvedClientId) {
      throw new ApiError(
        "المشروع لا يتبع العميل المحدد",
        400,
        "PROJECT_CLIENT_MISMATCH",
      )
    }

    resolvedClientId ??= project.clientId
  }

  if (resolvedServiceRequestId) {
    const serviceRequest = await db.serviceRequest.findFirst({
      where: { id: resolvedServiceRequestId, companyId },
      select: { id: true, clientId: true, projectId: true },
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

    if (
      resolvedProjectId &&
      serviceRequest.projectId &&
      serviceRequest.projectId !== resolvedProjectId
    ) {
      throw new ApiError(
        "طلب الخدمة لا يتبع المشروع المحدد",
        400,
        "SERVICE_REQUEST_PROJECT_MISMATCH",
      )
    }

    resolvedClientId ??= serviceRequest.clientId
    resolvedProjectId ??= serviceRequest.projectId
  }

  if (resolvedProjectId && currency) {
    const project = await db.project.findFirst({
      where: { id: resolvedProjectId, companyId },
      select: { currency: true },
    })

    if (!project) {
      throw new ApiError("المشروع المحدد غير موجود", 404, "PROJECT_NOT_FOUND")
    }

    if (project.currency !== currency) {
      throw new ApiError(
        `عملة المشروع ${project.currency} لا تطابق عملة المستند ${currency}`,
        400,
        "PROJECT_CURRENCY_MISMATCH",
      )
    }
  }

  return {
    clientId: resolvedClientId,
    projectId: resolvedProjectId,
    serviceRequestId: resolvedServiceRequestId,
  }
}

export async function projectFinanceSummary(
  companyId: string,
  projectId: string,
) {
  const [project, invoiceTotals, paymentTotals, expenseTotals, paidExpenseTotals] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { id: true, budget: true, currency: true },
    }),
    prisma.invoice.aggregate({
      where: {
        companyId,
        projectId,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] },
      },
      _sum: { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: {
        companyId,
        invoice: { projectId },
        status: "POSTED",
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        companyId,
        projectId,
        status: { in: ["APPROVED", "PAID"] },
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { companyId, projectId, status: "PAID" },
      _sum: { amount: true },
    }),
  ])

  if (!project) return null

  const budgetMinor = decimalMinor(project.budget)
  const invoicedMinor = decimalMinor(invoiceTotals._sum.totalAmount)
  const collectedMinor = decimalMinor(paymentTotals._sum.amount)
  const expenseMinor = decimalMinor(expenseTotals._sum.amount)
  const paidExpenseMinor = decimalMinor(paidExpenseTotals._sum.amount)

  return {
    budget: minorToMoney(budgetMinor),
    invoiced: minorToMoney(invoicedMinor),
    collected: minorToMoney(collectedMinor),
    outstanding: minorToMoney(Math.max(0, invoicedMinor - collectedMinor)),
    expenses: minorToMoney(expenseMinor),
    cashMargin: minorToMoney(collectedMinor - paidExpenseMinor),
    projectedMargin: minorToMoney(invoicedMinor - expenseMinor),
    currency: project.currency,
  }
}
