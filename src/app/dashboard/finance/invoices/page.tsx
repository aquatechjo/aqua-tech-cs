import { ACCESS_ROLES, assertRole, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { displayInvoiceStatus } from "@/lib/finance"
import { decimalMinor } from "@/lib/finance-server"
import { prisma } from "@/lib/prisma"
import InvoicesClient from "./InvoicesClient"

export default async function InvoicesPage() {
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeRead)

  const [invoices, clients, projects] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.client.findMany({
      where: { companyId: user.companyId, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where: {
        companyId: user.companyId,
        currency: user.company.currency,
        status: { notIn: ["CANCELLED", "ARCHIVED"] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, clientId: true, currency: true },
    }),
  ])

  return (
    <InvoicesClient
      invoices={invoices.map((invoice) => ({
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
        totalAmount: invoice.totalAmount.toString(),
        amountPaid: invoice.amountPaid.toString(),
        client: invoice.client,
        project: invoice.project,
      }))}
      clients={clients}
      projects={projects}
      canManage={hasRole(user.role, ACCESS_ROLES.financeManagement)}
      defaultCurrency={user.company.currency}
    />
  )
}
