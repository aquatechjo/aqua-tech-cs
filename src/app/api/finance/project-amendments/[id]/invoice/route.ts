import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { nextDocumentNumber, assertOperationalCurrency } from "@/lib/finance-server"
import {
  amendmentInvoiceDescription,
  amendmentInvoiceIssues,
} from "@/lib/project-amendment-invoice"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"

type Context = { params: Promise<{ id: string }> }

async function createAmendmentInvoice(request: Request, context: Context) {
  assertSameOrigin(request)
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeManagement)
  const { id } = await context.params
  const meta = await getRequestMeta()

  const invoice = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id" FROM "ProjectContractAmendment"
      WHERE "id" = ${id} AND "companyId" = ${user.companyId}
      FOR UPDATE
    `
    const amendment = await tx.projectContractAmendment.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        project: { select: { id: true, name: true, clientId: true, currency: true } },
      },
    })
    if (!amendment) {
      throw new ApiError("ملحق العقد غير موجود", 404, "PROJECT_AMENDMENT_NOT_FOUND")
    }

    const issues = amendmentInvoiceIssues({
      status: amendment.status,
      impactAppliedAt: amendment.impactAppliedAt,
      invoiceId: amendment.invoiceId,
      amount: amendment.financialAmountSnapshot.toString(),
      amendmentCurrency: amendment.financialCurrencySnapshot,
      projectCurrency: amendment.project.currency,
      clientId: amendment.project.clientId,
    })
    if (issues.length) {
      throw new ApiError(issues[0], 409, "PROJECT_AMENDMENT_INVOICE_BLOCKED")
    }

    await assertOperationalCurrency(
      tx,
      user.companyId,
      amendment.financialCurrencySnapshot,
    )
    const invoiceNumber = await nextDocumentNumber(
      tx,
      user.companyId,
      "INV",
      new Date(),
      user.company.timezone,
    )
    const amount = amendment.financialAmountSnapshot
    const created = await tx.invoice.create({
      data: {
        companyId: user.companyId,
        clientId: amendment.project.clientId!,
        projectId: amendment.projectId,
        createdById: user.id,
        invoiceNumber,
        status: "DRAFT",
        currency: amendment.financialCurrencySnapshot,
        subtotal: amount,
        discountAmount: "0.00",
        taxAmount: "0.00",
        totalAmount: amount,
        amountPaid: "0.00",
        notes: `تم إنشاؤها من ${amendment.amendmentNumber}. راجع الضريبة والاستحقاق قبل الإصدار.`,
        items: {
          create: {
            companyId: user.companyId,
            description: amendmentInvoiceDescription(
              amendment.amendmentNumber,
              amendment.titleSnapshot,
            ),
            quantity: "1.00",
            unitPrice: amount,
            lineTotal: amount,
            sortOrder: 0,
          },
        },
      },
    })

    await tx.projectContractAmendment.update({
      where: { id: amendment.id },
      data: {
        invoiceId: created.id,
        invoiceCreatedById: user.id,
        invoiceCreatedAt: new Date(),
      },
    })
    await logActivity({
      db: tx,
      companyId: user.companyId,
      userId: user.id,
      action: ActivityAction.PROJECT_AMENDMENT_INVOICE_CREATED,
      entityType: "ProjectContractAmendment",
      entityId: amendment.id,
      message: `تم إنشاء مسودة الفاتورة ${created.invoiceNumber} من الملحق ${amendment.amendmentNumber}`,
      metadata: {
        projectId: amendment.projectId,
        amendmentNumber: amendment.amendmentNumber,
        invoiceId: created.id,
        invoiceNumber: created.invoiceNumber,
        amount: amount.toString(),
        currency: amendment.financialCurrencySnapshot,
      },
      ...meta,
    })

    return created
  }, { isolationLevel: "Serializable" })

  return ok({
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalAmount: invoice.totalAmount.toString(),
      currency: invoice.currency,
    },
  }, 201)
}

export const POST = withApiHandler(
  "PROJECT_AMENDMENT_INVOICE_CREATE_ERROR",
  createAmendmentInvoice,
  "تعذر إنشاء مسودة فاتورة الملحق",
)
