import { z } from "zod"

export const invoiceCollectionSchema = z.object({ status: z.enum(["NEW", "CONTACTED", "PROMISED", "DISPUTED", "ESCALATED", "CLOSED"]), ownerId: z.string().trim().min(1).optional().nullable(), nextAction: z.string().trim().max(500).optional().nullable(), nextActionAt: z.string().trim().optional().nullable(), promiseDate: z.string().trim().optional().nullable(), notes: z.string().trim().max(2000).optional().nullable() })

export function invoiceCollectionIssues(input: { invoiceStatus: string; amountOutstanding: number; status: string; nextAction: string | null | undefined; nextActionAt: Date | string | null | undefined; promiseDate: Date | string | null | undefined }) {
  const issues: string[] = []
  if (!["ISSUED", "PARTIALLY_PAID"].includes(input.invoiceStatus) || input.amountOutstanding <= 0) issues.push("متابعة التحصيل متاحة للفواتير المفتوحة فقط")
  if (input.status === "PROMISED" && !input.promiseDate) issues.push("تاريخ وعد الدفع مطلوب لهذه الحالة")
  if (input.status !== "CLOSED" && (!input.nextAction?.trim() || !input.nextActionAt)) issues.push("الإجراء القادم وتاريخه مطلوبان للمتابعة المفتوحة")
  return issues
}
