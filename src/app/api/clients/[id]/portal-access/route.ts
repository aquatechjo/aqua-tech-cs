import { z } from 'zod';
import { ActivityAction } from '@/generated/prisma/enums';
import { ACCESS_ROLES, assertRole } from '@/lib/access-control';
import { logActivity } from '@/lib/activity';
import { ApiError, ok, withApiHandler } from '@/lib/api-response';
import { getRequestMeta, requireAuth } from '@/lib/auth';
import { clientPortalPath } from '@/lib/client-portal';
import { createClientPortalAccess } from '@/lib/client-portal-server';
import { prisma } from '@/lib/prisma';
import { assertSameOrigin, readJsonBody } from '@/lib/request-security';

const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ISSUE') }),
  z.object({ action: z.literal('REVOKE') }),
]);

async function manage(request: Request, { params }: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request);
  const user = await requireAuth();
  assertRole(user.role, ACCESS_ROLES.clientManagement);
  const { id } = await params;
  const parsed = inputSchema.safeParse(await readJsonBody(request));
  if (!parsed.success)
    throw new ApiError('بيانات بوابة العميل غير صحيحة', 400, 'INVALID_CLIENT_PORTAL_INPUT');
  const meta = await getRequestMeta();
  const now = new Date();

  const result = await prisma.$transaction(
    async (tx) => {
      const client = await tx.client.findFirst({ where: { id, companyId: user.companyId } });
      if (!client) throw new ApiError('العميل غير موجود', 404, 'CLIENT_NOT_FOUND');

      if (parsed.data.action === 'ISSUE') {
        const access = createClientPortalAccess();
        await tx.clientPortalAccess.upsert({
          where: { clientId: client.id },
          create: {
            companyId: user.companyId,
            clientId: client.id,
            tokenHash: access.tokenHash,
            issuedAt: now,
          },
          update: { tokenHash: access.tokenHash, issuedAt: now, revokedAt: null },
        });
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.CLIENT_PORTAL_ACCESS_ISSUED,
          entityType: 'Client',
          entityId: client.id,
          message: `تم إصدار رابط بوابة العميل لـ ${client.name}`,
          metadata: { clientId: client.id },
          ...meta,
        });
        return { active: true, path: clientPortalPath(access.token) };
      }

      await tx.clientPortalAccess.updateMany({
        where: { clientId: client.id },
        data: { tokenHash: null, revokedAt: now },
      });
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.CLIENT_PORTAL_ACCESS_REVOKED,
        entityType: 'Client',
        entityId: client.id,
        message: `تم إلغاء رابط بوابة العميل لـ ${client.name}`,
        metadata: { clientId: client.id },
        ...meta,
      });
      return { active: false, path: null };
    },
    { isolationLevel: 'Serializable' },
  );

  return ok(result);
}

export const POST = withApiHandler('CLIENT_PORTAL_ACCESS_ERROR', manage, 'تعذر إدارة بوابة العميل');
