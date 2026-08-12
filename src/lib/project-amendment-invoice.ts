export function amendmentInvoiceIssues({
  status,
  impactAppliedAt,
  invoiceId,
  amount,
  amendmentCurrency,
  projectCurrency,
  clientId,
}: {
  status: string
  impactAppliedAt?: Date | string | null
  invoiceId?: string | null
  amount: string | number
  amendmentCurrency: string
  projectCurrency: string
  clientId?: string | null
}) {
  const issues: string[] = []

  if (status !== "ACCEPTED") {
    issues.push("يجب قبول ملحق العقد قبل إنشاء مسودة الفاتورة")
  }
  if (!impactAppliedAt) {
    issues.push("يجب تطبيق أثر الملحق على المشروع أولًا")
  }
  if (invoiceId) {
    issues.push("تم إنشاء فاتورة لهذا الملحق مسبقًا")
  }
  if (!clientId) {
    issues.push("يجب ربط المشروع بعميل قبل إنشاء الفاتورة")
  }
  if (amendmentCurrency !== projectCurrency) {
    issues.push("عملة الملحق لا تطابق عملة المشروع")
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    issues.push("قيمة الملحق القابلة للفوترة يجب أن تكون أكبر من صفر")
  }

  return issues
}

export function amendmentInvoiceDescription(
  amendmentNumber: string,
  title: string,
) {
  return `ملحق العقد ${amendmentNumber} — ${title}`.slice(0, 300)
}
