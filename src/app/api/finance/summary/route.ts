import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { handleApiError, ok } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { decimalMinor } from "@/lib/finance-server"
import { businessDate, minorToMoney } from "@/lib/finance"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.financeRead)

    const now = new Date()
    const overdueBefore = businessDate(now, user.company.timezone)

    const [
      invoiceTotals,
      paymentTotals,
      expenseTotals,
      paidExpenseTotals,
      overdueCount,
      recentInvoices,
      projectRows,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          companyId: user.companyId,
          status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] },
        },
        _sum: { totalAmount: true },
      }),
      prisma.payment.aggregate({
        where: { companyId: user.companyId, status: "POSTED" },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          companyId: user.companyId,
          status: { in: ["APPROVED", "PAID"] },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { companyId: user.companyId, status: "PAID" },
        _sum: { amount: true },
      }),
      prisma.invoice.count({
        where: {
          companyId: user.companyId,
          status: { in: ["ISSUED", "PARTIALLY_PAID"] },
          dueDate: { lt: overdueBefore },
        },
      }),
      prisma.invoice.findMany({
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.project.findMany({
        where: {
          companyId: user.companyId,
          status: { notIn: ["CANCELLED", "ARCHIVED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          name: true,
          code: true,
          budget: true,
          currency: true,
          invoices: {
            where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } },
            select: { totalAmount: true, amountPaid: true },
          },
          expenses: {
            where: { status: { in: ["APPROVED", "PAID"] } },
            select: { amount: true, status: true },
          },
        },
      }),
    ])

    const invoicedMinor = decimalMinor(invoiceTotals._sum.totalAmount)
    const collectedMinor = decimalMinor(paymentTotals._sum.amount)
    const expenseMinor = decimalMinor(expenseTotals._sum.amount)
    const paidExpenseMinor = decimalMinor(paidExpenseTotals._sum.amount)

    return ok({
      totals: {
        currency: user.company.currency,
        invoiced: minorToMoney(invoicedMinor),
        collected: minorToMoney(collectedMinor),
        outstanding: minorToMoney(Math.max(0, invoicedMinor - collectedMinor)),
        approvedExpenses: minorToMoney(expenseMinor),
        paidExpenses: minorToMoney(paidExpenseMinor),
        cashMargin: minorToMoney(collectedMinor - paidExpenseMinor),
        projectedMargin: minorToMoney(invoicedMinor - expenseMinor),
        overdueCount,
      },
      recentInvoices: recentInvoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        totalAmount: invoice.totalAmount.toString(),
        amountPaid: invoice.amountPaid.toString(),
        currency: invoice.currency,
        dueDate: invoice.dueDate?.toISOString() ?? null,
        client: invoice.client,
        project: invoice.project,
      })),
      projects: projectRows.map((project) => {
        const invoiced = project.invoices.reduce(
          (sum, invoice) => sum + decimalMinor(invoice.totalAmount),
          0,
        )
        const collected = project.invoices.reduce(
          (sum, invoice) => sum + decimalMinor(invoice.amountPaid),
          0,
        )
        const expenses = project.expenses.reduce(
          (sum, expense) => sum + decimalMinor(expense.amount),
          0,
        )
        const paidExpenses = project.expenses.reduce(
          (sum, expense) =>
            expense.status === "PAID"
              ? sum + decimalMinor(expense.amount)
              : sum,
          0,
        )

        return {
          id: project.id,
          name: project.name,
          code: project.code,
          currency: project.currency,
          budget: project.budget?.toString() ?? "0.00",
          invoiced: minorToMoney(invoiced),
          collected: minorToMoney(collected),
          expenses: minorToMoney(expenses),
          projectedMargin: minorToMoney(invoiced - expenses),
          cashMargin: minorToMoney(collected - paidExpenses),
        }
      }),
    })
  } catch (error) {
    return handleApiError(error, "FINANCE_SUMMARY_GET_ERROR")
  }
}
