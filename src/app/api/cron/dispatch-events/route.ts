import { ApiError, ok, withApiHandler } from '@/lib/api-response';
import { dispatchPendingDomainEvents } from '@/lib/domain-events';
import { safeEqualSecrets } from '@/lib/request-security';

export const dynamic = 'force-dynamic';

async function run(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get('authorization');
  const received = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!expected || !received || !safeEqualSecrets(received, expected))
    throw new ApiError('غير مصرح بتشغيل عامل الأحداث', 401, 'INVALID_CRON_SECRET');

  const summary = await dispatchPendingDomainEvents({ limit: 100 });
  return ok(summary);
}

export const GET = withApiHandler(
  'DOMAIN_EVENT_DISPATCH_ERROR',
  run,
  'تعذر تشغيل عامل الأحداث المجدول',
);
