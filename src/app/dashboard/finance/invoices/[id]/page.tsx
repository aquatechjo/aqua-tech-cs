import { notFound } from "next/navigation"
import { ACCESS_ROLES, assertRole, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { displayInvoiceStatus, localDateKey } from "@/lib/finance"
import { decimalMinor } from "@/lib/finance-server"
import { prisma } from "@/lib/prisma"
import InvoiceDetailClient from "./InvoiceDetailClient"

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeRead)
  const { id } = await params

  const [invoice, collectionOwners] = await Promise.all([prisma.invoice.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      project: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      collectionOwner: { select: { id: true, name: true, email: true } },
      contractAmendment: true,
      items: { orderBy: { sortOrder: "asc" } },
      payments: {
        orderBy: { paidAt: "desc" },
        include: {
          recordedBy: { select: { id: true, name: true } },
          reversedBy: { select: { id: true, name: true } },
        },
      },
    },
  }), prisma.user.findMany({ where: { companyId: user.companyId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } })])

  if (!invoice) notFound()

  return (
    <InvoiceDetailClient
      canManage={hasRole(user.role, ACCESS_ROLES.financeManagement)}
      defaultDate={localDateKey(new Date(), user.company.timezone)}
      collectionOwners={collectionOwners}
      invoice={{
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        displayStatus: displayInvoiceStatus({
          status: invoice.status,
          dueDate: invoice.dueDate,
          totalMinor: decimalMinor(invoice.totalAmount),
          amountPaidMinor: decimalMinor(invoice.amountPaid),
          timeZone: user.company.timezone,
        }),
        currency: invoice.currency,
        issueDate: invoice.issueDate?.toISOString() ?? null,
        dueDate: invoice.dueDate?.toISOString() ?? null,
        subtotal: invoice.subtotal.toString(),
        discountAmount: invoice.discountAmount.toString(),
        taxAmount: invoice.taxAmount.toString(),
        totalAmount: invoice.totalAmount.toString(),
        amountPaid: invoice.amountPaid.toString(),
        notes: invoice.notes,
        terms: invoice.terms,
        client: invoice.client,
        project: invoice.project,
        createdBy: invoice.createdBy,
        collectionOwner: invoice.collectionOwner,
        collectionStatus: invoice.collectionStatus,
        collectionNextAction: invoice.collectionNextAction,
        collectionNextActionAt: invoice.collectionNextActionAt?.toISOString() ?? null,
        collectionPromiseDate: invoice.collectionPromiseDate?.toISOString() ?? null,
        collectionNotes: invoice.collectionNotes,
        collectionUpdatedAt: invoice.collectionUpdatedAt?.toISOString() ?? null,
        contractAmendment: invoice.contractAmendment
          ? {
              id: invoice.contractAmendment.id,
              amendmentNumber: invoice.contractAmendment.amendmentNumber,
              financialAmount:
                invoice.contractAmendment.financialAmountSnapshot.toString(),
              invoiceIssuedAt:
                invoice.contractAmendment.invoiceIssuedAt?.toISOString() ?? null,
              invoiceIssueReference:
                invoice.contractAmendment.invoiceIssueReference,
              invoiceTaxDecision:
                invoice.contractAmendment.invoiceTaxDecision === "TAX_APPLIED" ||
                invoice.contractAmendment.invoiceTaxDecision === "TAX_EXEMPT"
                  ? invoice.contractAmendment.invoiceTaxDecision
                  : null,
              invoiceDeliveryRecipientName:
                invoice.contractAmendment.invoiceDeliveryRecipientName,
              invoiceDeliveryRecipientEmail:
                invoice.contractAmendment.invoiceDeliveryRecipientEmail,
              invoiceDeliveryReference:
                invoice.contractAmendment.invoiceDeliveryReference,
              invoiceDeliverySentAt:
                invoice.contractAmendment.invoiceDeliverySentAt?.toISOString() ?? null,
              invoiceDeliveryFailedAt:
                invoice.contractAmendment.invoiceDeliveryFailedAt?.toISOString() ?? null,
              invoiceDeliveryAttemptCount:
                invoice.contractAmendment.invoiceDeliveryAttemptCount,
              invoicePortalExpiresAt:
                invoice.contractAmendment.invoicePortalExpiresAt?.toISOString() ?? null,
              invoicePortalIssuedAt:
                invoice.contractAmendment.invoicePortalIssuedAt?.toISOString() ?? null,
              invoicePortalRevokedAt:
                invoice.contractAmendment.invoicePortalRevokedAt?.toISOString() ?? null,
              invoicePortalFirstViewedAt:
                invoice.contractAmendment.invoicePortalFirstViewedAt?.toISOString() ?? null,
              invoicePortalLastViewedAt:
                invoice.contractAmendment.invoicePortalLastViewedAt?.toISOString() ?? null,
              invoicePortalViewCount:
                invoice.contractAmendment.invoicePortalViewCount,
              invoicePortalDeliveryRecipientName:
                invoice.contractAmendment.invoicePortalDeliveryRecipientName,
              invoicePortalDeliveryRecipientEmail:
                invoice.contractAmendment.invoicePortalDeliveryRecipientEmail,
              invoicePortalDeliverySentAt:
                invoice.contractAmendment.invoicePortalDeliverySentAt?.toISOString() ?? null,
              invoicePortalDeliveryFailedAt:
                invoice.contractAmendment.invoicePortalDeliveryFailedAt?.toISOString() ?? null,
              invoicePortalDeliveryAttemptCount:
                invoice.contractAmendment.invoicePortalDeliveryAttemptCount,
              invoiceReminderSentAt:
                invoice.contractAmendment.invoiceReminderSentAt?.toISOString() ?? null,
              invoiceReminderFailedAt:
                invoice.contractAmendment.invoiceReminderFailedAt?.toISOString() ?? null,
              invoiceReminderAttemptCount:
                invoice.contractAmendment.invoiceReminderAttemptCount,
              invoiceReminderCount:
                invoice.contractAmendment.invoiceReminderCount,
              invoiceReminderScheduleEnabled:
                invoice.contractAmendment.invoiceReminderScheduleEnabled,
              invoiceReminderNextAt:
                invoice.contractAmendment.invoiceReminderNextAt?.toISOString() ?? null,
            }
          : null,
        items: invoice.items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          lineTotal: item.lineTotal.toString(),
          sortOrder: item.sortOrder,
        })),
        payments: invoice.payments.map((payment) => ({
          id: payment.id,
          amount: payment.amount.toString(),
          currency: payment.currency,
          method: payment.method,
          status: payment.status,
          reference: payment.reference,
          notes: payment.notes,
          paidAt: payment.paidAt.toISOString(),
          reversedAt: payment.reversedAt?.toISOString() ?? null,
          reversalReason: payment.reversalReason,
          recordedBy: payment.recordedBy,
          reversedBy: payment.reversedBy,
          receiptRecipientEmail: payment.receiptRecipientEmail,
          receiptSentAt: payment.receiptSentAt?.toISOString() ?? null,
          receiptFailedAt: payment.receiptFailedAt?.toISOString() ?? null,
          receiptDeliveryAttemptCount: payment.receiptDeliveryAttemptCount,
        })),
      }}
    />
  )
}
