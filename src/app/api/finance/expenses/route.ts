import { z } from "zod"
import { ActivityAction, type ExpenseStatus } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { businessDate, minorToMoney, parseScaledDecimal } from "@/lib/finance"
import { assertOperationalCurrency, nextDocumentNumber } from "@/lib/finance-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const receiptUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine(
    (value) => value.startsWith("https://") || value.startsWith("http://"),
    "رابط الإيصال يجب أن يبدأ بـ http أو https",
  )

const expenseSchema = z.object({
  projectId: z.string().trim().optional().nullable(),
  vendorName: z.string().trim().max(250).optional().nullable(),
  category: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(1000),
  amount: z.union([z.string(), z.number()]),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("JOD"),
  incurredAt: z.string().trim().optional().nullable(),
  reference: z.string().trim().max(250).optional().nullable(),
  receiptUrl: receiptUrlSchema.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  submitImmediately: z.boolean().optional().default(false),
})

function nullableText(value: string | null | undefined) {
  const text = value?.trim()
  return text || null
}

function expenseDate(
  value: string | null | undefined,
  timeZone: string,
) {
  if (!value) return businessDate(new Date(), timeZone)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ApiError("تاريخ المصروف غير صحيح", 400, "INVALID_EXPENSE_DATE")
  }
  return date
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.financeRead)

    const url = new URL(request.url)
    const statusValue = url.searchParams.get("status")
    const expenseStatuses: ExpenseStatus[] = [
      "DRAFT",
      "SUBMITTED",
      "APPROVED",
      "REJECTED",
      "PAID",
      "CANCELLED",
    ]
    const status = expenseStatuses.includes(statusValue as ExpenseStatus)
      ? (statusValue as ExpenseStatus)
      : null
    const projectId = url.searchParams.get("projectId")
    const q = url.searchParams.get("q")?.trim()

    const expenses = await prisma.expense.findMany({
      where: {
        companyId: user.companyId,
        ...(status ? { status } : {}),
        ...(projectId ? { projectId } : {}),
        ...(q
          ? {
              OR: [
                { expenseNumber: { contains: q, mode: "insensitive" } },
                { vendorName: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
      take: 300,
      include: {
        project: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    })

    return ok({
      expenses: expenses.map((expense) => ({
        ...expense,
        amount: expense.amount.toString(),
        incurredAt: expense.incurredAt.toISOString(),
        submittedAt: expense.submittedAt?.toISOString() ?? null,
        approvedAt: expense.approvedAt?.toISOString() ?? null,
        rejectedAt: expense.rejectedAt?.toISOString() ?? null,
        paidAt: expense.paidAt?.toISOString() ?? null,
        cancelledAt: expense.cancelledAt?.toISOString() ?? null,
        createdAt: expense.createdAt.toISOString(),
        updatedAt: expense.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    return handleApiError(error, "FINANCE_EXPENSES_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.expenseSubmission)

    const parsed = expenseSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات المصروف غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    let amountMinor: number
    try {
      amountMinor = parseScaledDecimal(parsed.data.amount)
    } catch {
      throw new ApiError("قيمة المصروف غير صحيحة", 400, "INVALID_EXPENSE_AMOUNT")
    }

    if (amountMinor <= 0) {
      throw new ApiError("قيمة المصروف يجب أن تكون أكبر من صفر", 400, "INVALID_EXPENSE_AMOUNT")
    }

    if (parsed.data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: parsed.data.projectId, companyId: user.companyId },
        select: { id: true, currency: true },
      })
      if (!project) {
        throw new ApiError("المشروع المحدد غير موجود", 404, "PROJECT_NOT_FOUND")
      }
      if (project.currency !== parsed.data.currency) {
        throw new ApiError(
          `عملة المشروع ${project.currency} لا تطابق عملة المصروف ${parsed.data.currency}`,
          400,
          "PROJECT_CURRENCY_MISMATCH",
        )
      }
    }

    const incurredAt = expenseDate(
      parsed.data.incurredAt,
      user.company.timezone,
    )
    const meta = await getRequestMeta()
    const now = new Date()

    const expense = await prisma.$transaction(async (tx) => {
      await assertOperationalCurrency(tx, user.companyId, parsed.data.currency)
      const expenseNumber = await nextDocumentNumber(
        tx,
        user.companyId,
        "EXP",
        incurredAt,
        user.company.timezone,
      )
      const created = await tx.expense.create({
        data: {
          companyId: user.companyId,
          projectId: parsed.data.projectId || null,
          createdById: user.id,
          expenseNumber,
          vendorName: nullableText(parsed.data.vendorName),
          category: parsed.data.category,
          description: parsed.data.description,
          amount: minorToMoney(amountMinor),
          currency: parsed.data.currency,
          status: parsed.data.submitImmediately ? "SUBMITTED" : "DRAFT",
          incurredAt,
          submittedAt: parsed.data.submitImmediately ? now : null,
          reference: nullableText(parsed.data.reference),
          receiptUrl: nullableText(parsed.data.receiptUrl),
          notes: nullableText(parsed.data.notes),
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.EXPENSE_CREATED,
        entityType: "Expense",
        entityId: created.id,
        message: `تم إنشاء المصروف ${created.expenseNumber}`,
        metadata: {
          amount: created.amount.toString(),
          currency: created.currency,
          projectId: created.projectId,
          status: created.status,
        },
        ...meta,
      })

      if (parsed.data.submitImmediately) {
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.EXPENSE_SUBMITTED,
          entityType: "Expense",
          entityId: created.id,
          message: `تم إرسال المصروف ${created.expenseNumber} للاعتماد`,
          ...meta,
        })
      }

      return created
    })

    return ok(
      {
        expense: {
          ...expense,
          amount: expense.amount.toString(),
          incurredAt: expense.incurredAt.toISOString(),
        },
      },
      201,
    )
  } catch (error) {
    return handleApiError(
      error,
      "FINANCE_EXPENSES_POST_ERROR",
      "تعذر إنشاء المصروف",
    )
  }
}
