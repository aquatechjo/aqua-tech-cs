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

  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      project: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      items: { orderBy: { sortOrder: "asc" } },
      payments: {
        orderBy: { paidAt: "desc" },
        include: {
          recordedBy: { select: { id: true, name: true } },
          reversedBy: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!invoice) notFound()

  return (
    <InvoiceDetailClient
      canManage={hasRole(user.role, ACCESS_ROLES.financeManagement)}
      defaultDate={localDateKey(new Date(), user.company.timezone)}
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
        })),
      }}
    />
  )
}
