import { ACCESS_ROLES, assertRole, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { localDateKey } from "@/lib/finance"
import { prisma } from "@/lib/prisma"
import ExpensesClient from "./ExpensesClient"

export default async function ExpensesPage() {
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeRead)

  const [expenses, projects] = await Promise.all([
    prisma.expense.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
      take: 300,
      include: {
        project: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.project.findMany({
      where: {
        companyId: user.companyId,
        currency: user.company.currency,
        status: { notIn: ["CANCELLED", "ARCHIVED"] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, currency: true },
    }),
  ])

  return (
    <ExpensesClient
      expenses={expenses.map((expense) => ({
        id: expense.id,
        expenseNumber: expense.expenseNumber,
        projectId: expense.projectId,
        project: expense.project,
        createdById: expense.createdById,
        createdBy: expense.createdBy,
        approvedBy: expense.approvedBy,
        vendorName: expense.vendorName,
        category: expense.category,
        description: expense.description,
        amount: expense.amount.toString(),
        currency: expense.currency,
        status: expense.status,
        incurredAt: expense.incurredAt.toISOString(),
        submittedAt: expense.submittedAt?.toISOString() ?? null,
        approvedAt: expense.approvedAt?.toISOString() ?? null,
        paidAt: expense.paidAt?.toISOString() ?? null,
        reference: expense.reference,
        receiptUrl: expense.receiptUrl,
        notes: expense.notes,
      }))}
      projects={projects}
      currentUserId={user.id}
      canApprove={hasRole(user.role, ACCESS_ROLES.financeManagement)}
      defaultCurrency={user.company.currency}
      defaultDate={localDateKey(new Date(), user.company.timezone)}
    />
  )
}
