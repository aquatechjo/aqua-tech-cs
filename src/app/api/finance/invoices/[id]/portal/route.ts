import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { INVOICE_PORTAL_DEFAULT_DAYS, invoicePortalIssues, invoicePortalPath } from "@/lib/project-amendment-invoice-portal"
import { createInvoicePortalAccess } from "@/lib/project-amendment-invoice-portal-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ISSUE"), validDays: z.number().int().min(1).max(30).default(INVOICE_PORTAL_DEFAULT_DAYS) }),
  z.object({ action: z.literal("REVOKE") }),
])

async function manage(request: Request, { params }: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeManagement)
  const { id } = await params
  const parsed = inputSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ApiError("بيانات بوابة الفاتورة غير صحيحة", 400, "INVALID_INVOICE_PORTAL_INPUT")
  const meta = await getRequestMeta()
  const now = new Date()
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} AND "companyId" = ${user.companyId} FOR UPDATE`
    const invoice = await tx.invoice.findFirst({ where: { id, companyId: user.companyId }, include: { contractAmendment: true } })
    if (!invoice?.contractAmendment) throw new ApiError("هذه ليست فاتورة ملحق عقد", 409, "AMENDMENT_INVOICE_REQUIRED")
    await tx.$queryRaw`SELECT "id" FROM "ProjectContractAmendment" WHERE "id" = ${invoice.contractAmendment.id} AND "companyId" = ${user.companyId} FOR UPDATE`
    if (parsed.data.action === "ISSUE") {
      const issues = invoicePortalIssues({ invoiceStatus: invoice.status, invoiceIssuedAt: invoice.contractAmendment.invoiceIssuedAt, issueDate: invoice.issueDate, dueDate: invoice.dueDate, issueReference: invoice.contractAmendment.invoiceIssueReference })
      if (issues.length) throw new ApiError(issues[0], 409, "INVOICE_PORTAL_BLOCKED")
      const access = createInvoicePortalAccess(now, parsed.data.validDays)
      await tx.projectContractAmendment.update({ where: { id: invoice.contractAmendment.id }, data: { invoicePortalTokenHash: access.tokenHash, invoicePortalExpiresAt: access.expiresAt, invoicePortalIssuedAt: now, invoicePortalRevokedAt: null, invoicePortalFirstViewedAt: null, invoicePortalLastViewedAt: null, invoicePortalViewCount: 0, invoiceReminderScheduleEnabled: false, invoiceReminderNextAt: null, invoiceReminderScheduleUpdatedAt: now } })
      await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_AMENDMENT_INVOICE_PORTAL_ISSUED, entityType: "ProjectContractAmendment", entityId: invoice.contractAmendment.id, message: `تم إصدار بوابة العميل للفاتورة ${invoice.invoiceNumber}`, metadata: { invoiceId: invoice.id, expiresAt: access.expiresAt.toISOString(), rotated: Boolean(invoice.contractAmendment.invoicePortalTokenHash) }, ...meta })
      return { active: true, path: invoicePortalPath(access.token), expiresAt: access.expiresAt.toISOString() }
    }
    await tx.projectContractAmendment.update({ where: { id: invoice.contractAmendment.id }, data: { invoicePortalTokenHash: null, invoicePortalExpiresAt: null, invoicePortalRevokedAt: now, invoiceReminderScheduleEnabled: false, invoiceReminderNextAt: null, invoiceReminderScheduleUpdatedAt: now } })
    await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_AMENDMENT_INVOICE_PORTAL_REVOKED, entityType: "ProjectContractAmendment", entityId: invoice.contractAmendment.id, message: `تم إلغاء بوابة العميل للفاتورة ${invoice.invoiceNumber}`, metadata: { invoiceId: invoice.id }, ...meta })
    return { active: false, path: null, expiresAt: null }
  }, { isolationLevel: "Serializable" })
  return ok(result)
}

export const POST = withApiHandler("INVOICE_PORTAL_ERROR", manage, "تعذر إدارة بوابة فاتورة العميل")
