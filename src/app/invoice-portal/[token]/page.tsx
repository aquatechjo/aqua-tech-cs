import type { Metadata } from 'next';
import InvoiceDocumentView from '@/components/finance/InvoiceDocumentView';
import { findPublicInvoiceByLink } from '@/lib/invoice-public-link-server';
import PublicInvoiceLinkActions from './PublicInvoiceLinkActions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'فاتورة Aqua.Tech',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default async function PublicInvoiceLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invoice = await findPublicInvoiceByLink(token);
  if (!invoice) {
    return (
      <main className="aqua-proposal-public" dir="rtl">
        <section className="aqua-proposal-public__invalid">
          <div className="aqua-proposal-public__invalid-card">
            <span className="aqua-proposal-public__status-mark">404</span>
            <h1>رابط الفاتورة غير متاح</h1>
            <p>قد يكون الرابط منتهيًا أو ملغيًا أو تم استبداله برابط أحدث.</p>
          </div>
        </section>
      </main>
    );
  }
  return <InvoiceDocumentView invoice={invoice} actions={<PublicInvoiceLinkActions />} />;
}
