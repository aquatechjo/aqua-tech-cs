import { z } from "zod"
import type { Prisma } from "@/generated/prisma/client"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole, hasRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  canTransitionExpense,
  minorToMoney,
  parseScaledDecimal,
  type ExpenseStatusValue,
} from "@/lib/finance"
import { assertOperationalCurrency } from "@/lib/finance-server"
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

const patchSchema = z.object({
  action: z.enum([
    "UPDATE",
    "SUBMIT",
    "APPROVE",
    "REJECT",
    "MARK_PAID",
    "CANCEL",
    "REOPEN",
  ]),
  projectId: z.string().trim().optional().nullable(),
  vendorName: z.string().trim().max(250).optional().nullable(),
  category: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(2).max(1000).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  incurredAt: z.string().trim().optional().nullable(),
  reference: z.string().trim().max(250).optional().nullable(),
  receiptUrl: receiptUrlSchema.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  reason: z.string().trim().max(1000).optional().nullable(),
  paidAt: z.string().trim().optional().nullable(),
})

function nullableText(value: string | null | undefined) {
  if (value === undefined) return undefined
  const text = value?.trim()
  return text || null
}

function optionalDate(value: string | null | undefined) {
  if (value === undefined) return undefined
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ApiError("التاريخ المدخل غير صحيح", 400, "INVALID_DATE")
  }
  return date
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.expenseSubmission)
    const { id } = await params

    const parsed = patchSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات المصروف غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    const expense = await prisma.expense.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!expense) {
      throw new ApiError("المصروف غير موجود", 404, "EXPENSE_NOT_FOUND")
    }

    const isFinanceManager = hasRole(user.role, ACCESS_ROLES.financeManagement)
    const isCreator = expense.createdById === user.id
    const action = parsed.data.action

    if (!isFinanceManager && !isCreator) {
      throw new ApiError(
        "يمكنك إدارة المصروفات التي أنشأتها فقط",
        403,
        "EXPENSE_FORBIDDEN",
      )
    }

    if (["APPROVE", "REJECT", "MARK_PAID"].includes(action) && !isFinanceManager) {
      throw new ApiError(
        "اعتماد المصروفات ودفعها متاح للإدارة المالية فقط",
        403,
        "FINANCE_APPROVAL_REQUIRED",
      )
    }

    if (
      action === "APPROVE" &&
      expense.createdById === user.id &&
      user.role !== "OWNER"
    ) {
      throw new ApiError(
        "لا يمكن لمن أنشأ المصروف اعتماد المصروف نفسه",
        409,
        "EXPENSE_SELF_APPROVAL_NOT_ALLOWED",
      )
    }

    if (
      action === "CANCEL" &&
      !isFinanceManager &&
      !["DRAFT", "REJECTED"].includes(expense.status)
    ) {
      throw new ApiError(
        "إلغاء المصروف بعد إرساله يتطلب صلاحية الإدارة المالية",
        403,
        "FINANCE_CANCELLATION_REQUIRED",
      )
    }

    const targetStatus: ExpenseStatusValue | null =
      action === "SUBMIT"
        ? "SUBMITTED"
        : action === "APPROVE"
          ? "APPROVED"
          : action === "REJECT"
            ? "REJECTED"
            : action === "MARK_PAID"
              ? "PAID"
              : action === "CANCEL"
                ? "CANCELLED"
                : action === "REOPEN"
                  ? "DRAFT"
                  : null

    if (targetStatus && !canTransitionExpense(expense.status, targetStatus)) {
      throw new ApiError(
        `لا يمكن نقل المصروف من ${expense.status} إلى ${targetStatus}`,
        409,
        "INVALID_EXPENSE_TRANSITION",
      )
    }

    if (action === "UPDATE" && !["DRAFT", "REJECTED"].includes(expense.status)) {
      throw new ApiError(
        "لا يمكن تعديل المصروف بعد إرساله للاعتماد",
        409,
        "EXPENSE_LOCKED",
      )
    }

    if ((action === "REJECT" || action === "CANCEL") && !parsed.data.reason?.trim()) {
      throw new ApiError("سبب الإجراء مطلوب", 400, "EXPENSE_REASON_REQUIRED")
    }

    if (parsed.data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: parsed.data.projectId, companyId: user.companyId },
        select: { id: true, currency: true },
      })
      if (!project) {
        throw new ApiError("المشروع المحدد غير موجود", 404, "PROJECT_NOT_FOUND")
      }

      const effectiveCurrency = parsed.data.currency ?? expense.currency
      if (project.currency !== effectiveCurrency) {
        throw new ApiError(
          `عملة المشروع ${project.currency} لا تطابق عملة المصروف ${effectiveCurrency}`,
          400,
          "PROJECT_CURRENCY_MISMATCH",
        )
      }
    }

    const effectiveCurrency = parsed.data.currency ?? expense.currency

    let amount: string | undefined
    if (parsed.data.amount !== undefined) {
      try {
        const amountMinor = parseScaledDecimal(parsed.data.amount)
        if (amountMinor <= 0) throw new Error("ZERO")
        amount = minorToMoney(amountMinor)
      } catch {
        throw new ApiError("قيمة المصروف غير صحيحة", 400, "INVALID_EXPENSE_AMOUNT")
      }
    }

    const incurredAt = optionalDate(parsed.data.incurredAt)
    const paidAt = optionalDate(parsed.data.paidAt)
    const effectiveIncurredAt = incurredAt ?? expense.incurredAt

    if (action === "MARK_PAID" && paidAt && paidAt.getTime() < effectiveIncurredAt.getTime()) {
      throw new ApiError(
        "تاريخ الدفع لا يمكن أن يسبق تاريخ المصروف",
        400,
        "PAYMENT_DATE_BEFORE_EXPENSE_DATE",
      )
    }

    const now = new Date()
    const meta = await getRequestMeta()

    const updated = await prisma.$transaction(async (tx) => {
      if (action === "UPDATE" && parsed.data.currency !== undefined) {
        await assertOperationalCurrency(tx, user.companyId, effectiveCurrency)
      }

      const updateData: Prisma.ExpenseUncheckedUpdateInput = {}

      if (action === "UPDATE") {
        Object.assign(updateData, {
          ...(parsed.data.projectId !== undefined
            ? { projectId: parsed.data.projectId || null }
            : {}),
          ...(nullableText(parsed.data.vendorName) !== undefined
            ? { vendorName: nullableText(parsed.data.vendorName) }
            : {}),
          ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
          ...(parsed.data.description !== undefined
            ? { description: parsed.data.description }
            : {}),
          ...(amount !== undefined ? { amount } : {}),
          ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
          ...(incurredAt !== undefined ? { incurredAt } : {}),
          ...(nullableText(parsed.data.reference) !== undefined
            ? { reference: nullableText(parsed.data.reference) }
            : {}),
          ...(nullableText(parsed.data.receiptUrl) !== undefined
            ? { receiptUrl: nullableText(parsed.data.receiptUrl) }
            : {}),
          ...(nullableText(parsed.data.notes) !== undefined
            ? { notes: nullableText(parsed.data.notes) }
            : {}),
        })
      } else if (action === "SUBMIT") {
        Object.assign(updateData, { status: "SUBMITTED", submittedAt: now })
      } else if (action === "APPROVE") {
        Object.assign(updateData, {
          status: "APPROVED",
          approvedById: user.id,
          approvedAt: now,
          rejectedAt: null,
        })
      } else if (action === "REJECT") {
        Object.assign(updateData, {
          status: "REJECTED",
          rejectedAt: now,
          notes: [expense.notes, `سبب الرفض: ${parsed.data.reason}`]
            .filter(Boolean)
            .join("\n"),
        })
      } else if (action === "MARK_PAID") {
        Object.assign(updateData, {
          status: "PAID",
          paidAt: paidAt ?? now,
        })
      } else if (action === "CANCEL") {
        Object.assign(updateData, {
          status: "CANCELLED",
          cancelledAt: now,
          notes: [expense.notes, `سبب الإلغاء: ${parsed.data.reason}`]
            .filter(Boolean)
            .join("\n"),
        })
      } else if (action === "REOPEN") {
        Object.assign(updateData, {
          status: "DRAFT",
          submittedAt: null,
          rejectedAt: null,
        })
      }

      const result = await tx.expense.update({
        where: { id: expense.id },
        data: updateData,
      })

      const activityByAction = {
        UPDATE: ActivityAction.EXPENSE_UPDATED,
        SUBMIT: ActivityAction.EXPENSE_SUBMITTED,
        APPROVE: ActivityAction.EXPENSE_APPROVED,
        REJECT: ActivityAction.EXPENSE_REJECTED,
        MARK_PAID: ActivityAction.EXPENSE_PAID,
        CANCEL: ActivityAction.EXPENSE_CANCELLED,
        REOPEN: ActivityAction.EXPENSE_UPDATED,
      } as const

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: activityByAction[action],
        entityType: "Expense",
        entityId: expense.id,
        message: `تم تحديث المصروف ${expense.expenseNumber}: ${action}`,
        metadata: { action, reason: parsed.data.reason ?? null },
        ...meta,
      })

      return result
    })

    return ok({
      expense: {
        ...updated,
        amount: updated.amount.toString(),
        incurredAt: updated.incurredAt.toISOString(),
        submittedAt: updated.submittedAt?.toISOString() ?? null,
        approvedAt: updated.approvedAt?.toISOString() ?? null,
        rejectedAt: updated.rejectedAt?.toISOString() ?? null,
        paidAt: updated.paidAt?.toISOString() ?? null,
        cancelledAt: updated.cancelledAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    return handleApiError(
      error,
      "FINANCE_EXPENSE_PATCH_ERROR",
      "تعذر تحديث المصروف",
    )
  }
}
