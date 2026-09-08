import { z } from 'zod';
import { ActivityAction } from '@/generated/prisma/enums';
import { ACCESS_ROLES, assertRole } from '@/lib/access-control';
import { logActivity } from '@/lib/activity';
import { ApiError, ok, withApiHandler } from '@/lib/api-response';
import { getRequestMeta, requireAuth } from '@/lib/auth';
import { createInvoicePublicLinkAccess } from '@/lib/invoice-public-link-server';
import {
  INVOICE_PUBLIC_LINK_DEFAULT_DAYS,
  invoicePublicLinkIssues,
  invoicePublicLinkPath,
} from '@/lib/invoice-public-link';
import { prisma } from '@/lib/prisma';
import { assertSameOrigin, readJsonBody } from '@/lib/request-security';

const inputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('ISSUE'),
    validDays: z.number().int().min(1).max(30).default(INVOICE_PUBLIC_LINK_DEFAULT_DAYS),
  }),
  z.object({ action: z.literal('REVOKE') }),
]);

async function manage(request: Request, { params }: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request);
  const user = await requireAuth();
  assertRole(user.role, ACCESS_ROLES.financeManagement);
  const { id } = await params;
  const parsed = inputSchema.safeParse(await readJsonBody(request));
  if (!parsed.success)
    throw new ApiError('بيانات الرابط العام غير صحيحة', 400, 'INVALID_INVOICE_PUBLIC_LINK_INPUT');
  const meta = await getRequestMeta();
  const now = new Date();

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} AND "companyId" = ${user.companyId} FOR UPDATE`;
      const invoice = await tx.invoice.findFirst({
        where: { id, companyId: user.companyId },
        include: { contractAmendment: { select: { id: true } } },
      });
      if (!invoice) throw new ApiError('الفاتورة غير موجودة', 404, 'INVOICE_NOT_FOUND');

      if (parsed.data.action === 'ISSUE') {
        const issues = invoicePublicLinkIssues({
          status: invoice.status,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          hasContractAmendment: Boolean(invoice.contractAmendment),
        });
        if (issues.length) throw new ApiError(issues[0], 409, 'INVOICE_PUBLIC_LINK_BLOCKED');
        const access = createInvoicePublicLinkAccess(now, parsed.data.validDays);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            publicTokenHash: access.tokenHash,
            publicExpiresAt: access.expiresAt,
            publicIssuedAt: now,
            publicRevokedAt: null,
            publicFirstViewedAt: null,
            publicLastViewedAt: null,
            publicViewCount: 0,
          },
        });
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.INVOICE_PUBLIC_LINK_ISSUED,
          entityType: 'Invoice',
          entityId: invoice.id,
          message: `تم إصدار رابط عام للفاتورة ${invoice.invoiceNumber}`,
          metadata: {
            invoiceId: invoice.id,
            expiresAt: access.expiresAt.toISOString(),
            rotated: Boolean(invoice.publicTokenHash),
          },
          ...meta,
        });
        return {
          active: true,
          path: invoicePublicLinkPath(access.token),
          expiresAt: access.expiresAt.toISOString(),
        };
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { publicTokenHash: null, publicExpiresAt: null, publicRevokedAt: now },
      });
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.INVOICE_PUBLIC_LINK_REVOKED,
        entityType: 'Invoice',
        entityId: invoice.id,
        message: `تم إلغاء الرابط العام للفاتورة ${invoice.invoiceNumber}`,
        metadata: { invoiceId: invoice.id },
        ...meta,
      });
      return { active: false, path: null, expiresAt: null };
    },
    { isolationLevel: 'Serializable' },
  );

  return ok(result);
}

export const POST = withApiHandler(
  'INVOICE_PUBLIC_LINK_ERROR',
  manage,
  'تعذر إدارة الرابط العام للفاتورة',
);
