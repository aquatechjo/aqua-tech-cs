import { parseScaledDecimal } from "@/lib/finance"

export const AMENDMENT_INVOICE_TAX_DECISIONS = [
  "TAX_APPLIED",
  "TAX_EXEMPT",
] as const

export type AmendmentInvoiceTaxDecision =
  (typeof AMENDMENT_INVOICE_TAX_DECISIONS)[number]

export function amendmentInvoiceEditIssues({
  itemsRequested,
  discountRequested,
  linksRequested,
}: {
  itemsRequested: boolean
  discountRequested: boolean
  linksRequested: boolean
}) {
  const issues: string[] = []
  if (itemsRequested) issues.push("بند ملحق العقد ثابت ولا يمكن تعديله")
  if (discountRequested) issues.push("لا يمكن تطبيق خصم على قيمة ملحق معتمدة")
  if (linksRequested) issues.push("ربط فاتورة ملحق العقد ثابت ولا يمكن تغييره")
  return issues
}

export function amendmentInvoiceIssuanceIssues({
  reference,
  dueDate,
  taxDecision,
  taxAmount,
  subtotal,
  discountAmount,
  amendmentAmount,
  currency,
  amendmentCurrency,
  projectId,
  amendmentProjectId,
  clientId,
  projectClientId,
  items,
}: {
  reference?: string | null
  dueDate?: Date | string | null
  taxDecision?: AmendmentInvoiceTaxDecision | null
  taxAmount: string | number
  subtotal: string | number
  discountAmount: string | number
  amendmentAmount: string | number
  currency: string
  amendmentCurrency: string
  projectId?: string | null
  amendmentProjectId: string
  clientId?: string | null
  projectClientId?: string | null
  items: readonly { quantity: string | number; unitPrice: string | number }[]
}) {
  const issues: string[] = []
  const referenceValue = reference?.trim() ?? ""
  const taxMinor = parseScaledDecimal(taxAmount)
  const subtotalMinor = parseScaledDecimal(subtotal)
  const discountMinor = parseScaledDecimal(discountAmount)
  const amendmentMinor = parseScaledDecimal(amendmentAmount)

  if (referenceValue.length < 3 || referenceValue.length > 200) {
    issues.push("مرجع إصدار فاتورة الملحق مطلوب")
  }
  if (!dueDate) issues.push("تاريخ استحقاق فاتورة الملحق مطلوب")
  if (!taxDecision) issues.push("قرار الضريبة مطلوب قبل الإصدار")
  if (taxDecision === "TAX_EXEMPT" && taxMinor !== 0) {
    issues.push("قرار الإعفاء يتطلب أن تكون الضريبة صفرًا")
  }
  if (taxDecision === "TAX_APPLIED" && taxMinor <= 0) {
    issues.push("قرار تطبيق الضريبة يتطلب مبلغ ضريبة موجبًا")
  }
  if (subtotalMinor !== amendmentMinor || discountMinor !== 0) {
    issues.push("القيمة الأساسية للفاتورة يجب أن تطابق الملحق دون خصم")
  }
  if (currency !== amendmentCurrency) {
    issues.push("عملة الفاتورة لا تطابق عملة الملحق")
  }
  if (projectId !== amendmentProjectId || clientId !== projectClientId) {
    issues.push("ربط الفاتورة لا يطابق مشروع وعميل الملحق")
  }
  if (
    items.length !== 1 ||
    parseScaledDecimal(items[0]?.quantity ?? 0) !== 100 ||
    parseScaledDecimal(items[0]?.unitPrice ?? 0) !== amendmentMinor
  ) {
    issues.push("بند فاتورة الملحق لا يطابق القيمة المعتمدة")
  }

  return issues
}
