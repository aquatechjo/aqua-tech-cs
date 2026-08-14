import "server-only"
import crypto from "node:crypto"
import { ActivityAction } from "@/generated/prisma/enums"
import { logActivity } from "@/lib/activity"
import { INVOICE_PORTAL_TOKEN_BYTES, invoicePortalExpiry, invoicePortalIsActive, isValidInvoicePortalToken } from "@/lib/project-amendment-invoice-portal"
import { prisma } from "@/lib/prisma"
import { hashOpaqueValue } from "@/lib/request-security"

export function createInvoicePortalAccess(now = new Date(), validDays?: number) {
  const token = crypto.randomBytes(INVOICE_PORTAL_TOKEN_BYTES).toString("base64url")
  return { token, tokenHash: hashOpaqueValue(token), expiresAt: invoicePortalExpiry(now, validDays) }
}

export async function findPublicAmendmentInvoice(token: string, now = new Date()) {
  if (!isValidInvoicePortalToken(token)) return null
  const tokenHash = hashOpaqueValue(token)
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ProjectContractAmendment" WHERE "invoicePortalTokenHash" = ${tokenHash} FOR UPDATE`
    const amendment = await tx.projectContractAmendment.findUnique({
      where: { invoicePortalTokenHash: tokenHash },
      include: { company: { select: { name: true, email: true } }, project: { select: { name: true, code: true } }, invoice: { include: { client: { select: { name: true, email: true, phone: true } }, items: { orderBy: { sortOrder: "asc" } } } } },
    })
    if (!amendment?.invoice || !invoicePortalIsActive({ tokenHash: amendment.invoicePortalTokenHash, expiresAt: amendment.invoicePortalExpiresAt, revokedAt: amendment.invoicePortalRevokedAt }, now)) return null
    if (!["ISSUED", "PARTIALLY_PAID", "PAID"].includes(amendment.invoice.status)) return null
    const firstView = !amendment.invoicePortalFirstViewedAt
    await tx.projectContractAmendment.update({ where: { id: amendment.id }, data: { invoicePortalFirstViewedAt: amendment.invoicePortalFirstViewedAt ?? now, invoicePortalLastViewedAt: now, invoicePortalViewCount: { increment: 1 } } })
    if (firstView) await logActivity({ db: tx, companyId: amendment.companyId, action: ActivityAction.PROJECT_AMENDMENT_INVOICE_PORTAL_VIEWED, entityType: "ProjectContractAmendment", entityId: amendment.id, message: `تم فتح بوابة الفاتورة ${amendment.invoice.invoiceNumber} لأول مرة`, metadata: { invoiceId: amendment.invoice.id } })
    return amendment
  }, { isolationLevel: "Serializable" })
}
