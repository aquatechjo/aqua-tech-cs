export type AmendmentInvoiceDocumentState = {
  status: string
  invoiceIssuedAt: Date | null
  issueDate: Date | null
  dueDate: Date | null
  issueReference: string | null
  taxDecision: string | null
}

export function amendmentInvoiceDocumentIssues(
  state: AmendmentInvoiceDocumentState,
) {
  const issues: string[] = []

  if (!["ISSUED", "PARTIALLY_PAID", "PAID"].includes(state.status)) {
    issues.push("المستند متاح فقط لفاتورة ملحق صادرة وغير ملغاة")
  }
  if (!state.invoiceIssuedAt || !state.issueDate || !state.dueDate) {
    issues.push("أدلة إصدار فاتورة الملحق غير مكتملة")
  }
  if (!state.issueReference?.trim()) {
    issues.push("مرجع إصدار فاتورة الملحق مفقود")
  }
  if (!["TAX_APPLIED", "TAX_EXEMPT"].includes(state.taxDecision ?? "")) {
    issues.push("قرار ضريبة فاتورة الملحق غير مكتمل")
  }

  return issues
}

export function invoiceDocumentFileName(invoiceNumber: string) {
  const safeNumber = invoiceNumber.replace(/[^A-Za-z0-9_-]+/gu, "-")
  return `${safeNumber || "invoice"}-amendment-invoice`
}
