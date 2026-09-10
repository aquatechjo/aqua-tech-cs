import 'server-only';
import crypto from 'node:crypto';
import { ActivityAction } from '@/generated/prisma/enums';
import { logActivity } from '@/lib/activity';
import {
  INVOICE_PUBLIC_LINK_TOKEN_BYTES,
  invoicePublicLinkExpiry,
  invoicePublicLinkIsActive,
  isValidInvoicePublicLinkToken,
} from '@/lib/invoice-public-link';
import { prisma } from '@/lib/prisma';
import { hashOpaqueValue } from '@/lib/request-security';

export function createInvoicePublicLinkAccess(now = new Date(), validDays?: number) {
  const token = crypto.randomBytes(INVOICE_PUBLIC_LINK_TOKEN_BYTES).toString('base64url');
  return {
    token,
    tokenHash: hashOpaqueValue(token),
    expiresAt: invoicePublicLinkExpiry(now, validDays),
  };
}

export async function findPublicInvoiceByLink(token: string, now = new Date()) {
  if (!isValidInvoicePublicLinkToken(token)) return null;
  const tokenHash = hashOpaqueValue(token);
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "publicTokenHash" = ${tokenHash} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({
        where: { publicTokenHash: tokenHash },
        include: {
          company: { select: { name: true, email: true } },
          project: { select: { name: true, code: true } },
          client: { select: { name: true, email: true, phone: true } },
          items: { orderBy: { sortOrder: 'asc' } },
        },
      });
      if (
        !invoice ||
        !invoicePublicLinkIsActive(
          {
            tokenHash: invoice.publicTokenHash,
            expiresAt: invoice.publicExpiresAt,
            revokedAt: invoice.publicRevokedAt,
          },
          now,
        )
      )
        return null;
      if (!['ISSUED', 'PARTIALLY_PAID', 'PAID'].includes(invoice.status)) return null;
      const firstView = !invoice.publicFirstViewedAt;
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          publicFirstViewedAt: invoice.publicFirstViewedAt ?? now,
          publicLastViewedAt: now,
          publicViewCount: { increment: 1 },
        },
      });
      if (firstView) {
        await logActivity({
          db: tx,
          companyId: invoice.companyId,
          action: ActivityAction.INVOICE_PUBLIC_LINK_VIEWED,
          entityType: 'Invoice',
          entityId: invoice.id,
          message: `تم فتح الرابط العام للفاتورة ${invoice.invoiceNumber} لأول مرة`,
          metadata: { invoiceId: invoice.id },
        });
      }
      return invoice;
    },
    { isolationLevel: 'Serializable' },
  );
}
