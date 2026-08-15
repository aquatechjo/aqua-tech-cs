import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { invoiceCollectionIssues, invoiceCollectionSchema } from "@/lib/invoice-collection"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

function optionalDate(value: string | null | undefined, field: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new ApiError(`${field} غير صحيح`, 400, "INVALID_COLLECTION_DATE")
  return date
}

async function updateCollection(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeManagement)
  const { id } = await context.params
  const parsed = invoiceCollectionSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ApiError("بيانات متابعة التحصيل غير صحيحة", 400, "INVALID_INVOICE_COLLECTION_INPUT")
  const nextActionAt = optionalDate(parsed.data.nextActionAt, "تاريخ الإجراء القادم")
  const promiseDate = optionalDate(parsed.data.promiseDate, "تاريخ وعد الدفع")
  const meta = await getRequestMeta()
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} AND "companyId" = ${user.companyId} FOR UPDATE`
    const invoice = await tx.invoice.findFirst({ where: { id, companyId: user.companyId } })
    if (!invoice) throw new ApiError("الفاتورة غير موجودة", 404, "INVOICE_NOT_FOUND")
    const issues = invoiceCollectionIssues({ invoiceStatus: invoice.status, amountOutstanding: Math.max(0, Number(invoice.totalAmount) - Number(invoice.amountPaid)), status: parsed.data.status, nextAction: parsed.data.nextAction, nextActionAt, promiseDate })
    if (issues.length) throw new ApiError(issues[0], 409, "INVOICE_COLLECTION_BLOCKED")
    if (parsed.data.ownerId) {
      const owner = await tx.user.findFirst({ where: { id: parsed.data.ownerId, companyId: user.companyId, isActive: true }, select: { id: true } })
      if (!owner) throw new ApiError("مسؤول المتابعة غير صالح", 409, "INVALID_COLLECTION_OWNER")
    }
    const result = await tx.invoice.update({ where: { id: invoice.id }, data: { collectionOwnerId: parsed.data.ownerId || null, collectionStatus: parsed.data.status, collectionNextAction: parsed.data.status === "CLOSED" ? null : parsed.data.nextAction?.trim() || null, collectionNextActionAt: parsed.data.status === "CLOSED" ? null : nextActionAt, collectionPromiseDate: parsed.data.status === "PROMISED" ? promiseDate : null, collectionNotes: parsed.data.notes?.trim() || null, collectionUpdatedAt: new Date() } })
    await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.INVOICE_COLLECTION_UPDATED, entityType: "Invoice", entityId: invoice.id, message: `تم تحديث متابعة تحصيل الفاتورة ${invoice.invoiceNumber}`, metadata: { previousStatus: invoice.collectionStatus, status: result.collectionStatus, ownerId: result.collectionOwnerId, nextAction: result.collectionNextAction, nextActionAt: result.collectionNextActionAt?.toISOString() ?? null, promiseDate: result.collectionPromiseDate?.toISOString() ?? null, notes: result.collectionNotes }, ...meta })
    return result
  }, { isolationLevel: "Serializable" })
  return ok({ collection: { status: updated.collectionStatus, ownerId: updated.collectionOwnerId, nextAction: updated.collectionNextAction, nextActionAt: updated.collectionNextActionAt?.toISOString() ?? null, promiseDate: updated.collectionPromiseDate?.toISOString() ?? null, notes: updated.collectionNotes, updatedAt: updated.collectionUpdatedAt?.toISOString() ?? null } })
}

export const POST = withApiHandler("INVOICE_COLLECTION_UPDATE_ERROR", updateCollection, "تعذر تحديث متابعة التحصيل")
