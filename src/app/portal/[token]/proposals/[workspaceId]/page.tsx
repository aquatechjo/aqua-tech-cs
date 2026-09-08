import type { Metadata } from 'next';
import { findClientPortalProposal } from '@/lib/client-portal-server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'عرض — بوابة العميل',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default async function ClientPortalProposalPage({
  params,
}: {
  params: Promise<{ token: string; workspaceId: string }>;
}) {
  const { token, workspaceId } = await params;
  const proposal = await findClientPortalProposal(token, workspaceId);

  if (!proposal) {
    return (
      <main dir="rtl" className="d-flex align-items-center justify-content-center min-vh-100 p-4">
        <div className="text-center">
          <h1 className="h4">العرض غير متاح</h1>
          <p className="text-secondary">
            تعذر العثور على هذا العرض ضمن بوابتك، أو أنه لم يعد نشطاً.
          </p>
        </div>
      </main>
    );
  }

  const { content } = proposal;

  return (
    <main dir="rtl" className="container py-5" data-client-portal-proposal>
      <header className="mb-4">
        <p className="text-secondary mb-1">{proposal.proposalNumber}</p>
        <h1 className="h3">{content.title}</h1>
        <p className="text-secondary">المدة المتوقعة: {content.estimatedDuration || '—'}</p>
      </header>

      {content.sections.map((section) => (
        <section key={section.id} className="mb-4">
          <h2 className="h6">{section.title}</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{section.body}</p>
        </section>
      ))}

      {content.paymentMilestones.length > 0 ? (
        <section className="mb-4">
          <h2 className="h6">دفعات السداد</h2>
          <ul className="list-group">
            {content.paymentMilestones.map((milestone) => (
              <li key={milestone.id} className="list-group-item d-flex justify-content-between">
                <span>
                  {milestone.label}{' '}
                  <span className="text-secondary small d-block">{milestone.dueCondition}</span>
                </span>
                <strong dir="ltr">{milestone.percentage}%</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-4">
        <h2 className="h6">الإجمالي</h2>
        <p className="h4" dir="ltr">
          {content.commercial.totals.grandTotal} {content.commercial.currency}
        </p>
      </section>

      <p className="text-secondary small">
        صالح حتى: <span dir="ltr">{new Date(proposal.validUntil).toISOString().slice(0, 10)}</span>{' '}
        — للرد الرسمي على هذا العرض (قبول أو طلب تعديل)، يرجى استخدام الرابط المرسل إليك عبر البريد
        الإلكتروني.
      </p>
    </main>
  );
}
