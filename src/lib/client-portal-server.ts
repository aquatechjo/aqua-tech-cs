import 'server-only';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { hashOpaqueValue } from '@/lib/request-security';
import {
  CLIENT_PORTAL_TOKEN_BYTES,
  clientPortalIsActive,
  isValidClientPortalToken,
} from '@/lib/client-portal';

export function createClientPortalAccess() {
  const token = crypto.randomBytes(CLIENT_PORTAL_TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashOpaqueValue(token) };
}

export async function findClientPortalByToken(token: string, now = new Date()) {
  if (!isValidClientPortalToken(token)) return null;
  const tokenHash = hashOpaqueValue(token);

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ClientPortalAccess" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
      const access = await tx.clientPortalAccess.findUnique({
        where: { tokenHash },
        include: {
          client: {
            include: {
              company: { select: { name: true, email: true } },
              invoices: {
                where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] } },
                orderBy: { issueDate: 'desc' },
              },
            },
          },
        },
      });
      if (
        !access ||
        !clientPortalIsActive({ tokenHash: access.tokenHash, revokedAt: access.revokedAt })
      )
        return null;

      await tx.clientPortalAccess.update({
        where: { id: access.id },
        data: { lastAccessedAt: now, accessCount: { increment: 1 } },
      });
      return access;
    },
    { isolationLevel: 'Serializable' },
  );
}

export async function findClientPortalInvoice(token: string, invoiceId: string) {
  if (!isValidClientPortalToken(token)) return null;
  const tokenHash = hashOpaqueValue(token);
  const access = await prisma.clientPortalAccess.findUnique({
    where: { tokenHash },
    select: { clientId: true, revokedAt: true },
  });
  if (!access || access.revokedAt) return null;

  return prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      clientId: access.clientId,
      status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] },
    },
    include: {
      company: { select: { name: true, email: true } },
      project: { select: { name: true, code: true } },
      client: { select: { name: true } },
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });
}
