import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { INVOICE_REMINDER_MAX_COUNT, invoiceReminderScheduleSchema, nextInvoiceReminderAt } from "@/lib/project-amendment-invoice-reminder"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

async function updateSchedule(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeManagement)
  const { id } = await context.params
  const parsed = invoiceReminderScheduleSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ApiError("إعداد الجدولة غير صالح", 400, "INVALID_INVOICE_REMINDER_SCHEDULE")
  const now = new Date()
  const meta = await getRequestMeta()
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} AND "companyId" = ${user.companyId} FOR UPDATE`
    const invoice = await tx.invoice.findFirst({ where: { id, companyId: user.companyId }, include: { contractAmendment: true } })
    if (!invoice?.contractAmendment) throw new ApiError("فاتورة ملحق العقد مطلوبة", 409, "AMENDMENT_INVOICE_REQUIRED")
    const amendment = invoice.contractAmendment
    if (parsed.data.enabled) {
      const outstanding = Number(invoice.totalAmount) - Number(invoice.amountPaid)
      if (!["ISSUED", "PARTIALLY_PAID"].includes(invoice.status) || outstanding <= 0) throw new ApiError("الفاتورة ليست بحاجة إلى تذكير دفع", 409, "INVOICE_REMINDER_NOT_REQUIRED")
      if (!amendment.invoicePortalDeliverySentAt || !amendment.invoicePortalTokenHash || !amendment.invoicePortalExpiresAt || amendment.invoicePortalRevokedAt || amendment.invoicePortalExpiresAt <= now) throw new ApiError("بوابة الفاتورة غير فعالة", 409, "INVOICE_PORTAL_NOT_ACTIVE")
      if (amendment.invoiceReminderCount >= INVOICE_REMINDER_MAX_COUNT) throw new ApiError("تم بلوغ الحد الأقصى للتذكيرات", 409, "INVOICE_REMINDER_LIMIT_REACHED")
    }
    const lastContact = amendment.invoiceReminderSentAt ?? amendment.invoicePortalDeliverySentAt
    if (parsed.data.enabled && !lastContact) throw new ApiError("أرسل بوابة الفاتورة أولًا", 409, "INVOICE_PORTAL_DELIVERY_REQUIRED")
    const result = await tx.projectContractAmendment.update({ where: { id: amendment.id }, data: { invoiceReminderScheduleEnabled: parsed.data.enabled, invoiceReminderNextAt: parsed.data.enabled ? nextInvoiceReminderAt(lastContact!, now) : null, invoiceReminderScheduleUpdatedAt: now } })
    await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: parsed.data.enabled ? ActivityAction.PROJECT_AMENDMENT_INVOICE_REMINDER_SCHEDULE_ENABLED : ActivityAction.PROJECT_AMENDMENT_INVOICE_REMINDER_SCHEDULE_DISABLED, entityType: "ProjectContractAmendment", entityId: amendment.id, message: `${parsed.data.enabled ? "تم تفعيل" : "تم إيقاف"} جدولة تذكيرات الفاتورة ${invoice.invoiceNumber}`, metadata: { invoiceId: invoice.id, nextAt: result.invoiceReminderNextAt?.toISOString() ?? null }, ...meta })
    return result
  }, { isolationLevel: "Serializable" })
  return ok({ enabled: updated.invoiceReminderScheduleEnabled, nextAt: updated.invoiceReminderNextAt?.toISOString() ?? null })
}

export const POST = withApiHandler("INVOICE_REMINDER_SCHEDULE_ERROR", updateSchedule, "تعذر تحديث جدولة تذكير الفاتورة")
