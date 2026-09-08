import type { Metadata } from 'next';
import Link from 'next/link';
import { findClientPortalByToken } from '@/lib/client-portal-server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'بوابة العميل — Aqua.Tech',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

function money(value: { toString(): string }, currency: string) {
  return `${Number(value.toString()).toLocaleString('en-JO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  ISSUED: 'صادرة',
  PARTIALLY_PAID: 'مدفوعة جزئياً',
  PAID: 'مدفوعة بالكامل',
};

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await findClientPortalByToken(token);

  if (!access) {
    return (
      <main dir="rtl" className="d-flex align-items-center justify-content-center min-vh-100 p-4">
        <div className="text-center">
          <h1 className="h4">رابط البوابة غير متاح</h1>
          <p className="text-secondary">
            قد يكون الرابط ملغياً. تواصل مع فريق Aqua.Tech للحصول على رابط جديد.
          </p>
        </div>
      </main>
    );
  }

  const { client } = access;

  return (
    <main dir="rtl" className="container py-5" data-client-portal>
      <header className="mb-4">
        <p className="text-secondary mb-1">{client.company.name}</p>
        <h1 className="h3">مرحباً {client.name}</h1>
      </header>

      <section>
        <h2 className="h5 mb-3">الفواتير</h2>
        {client.invoices.length === 0 ? (
          <p className="text-secondary">لا توجد فواتير متاحة حالياً.</p>
        ) : (
          <div className="list-group">
            {client.invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/portal/${token}/invoices/${invoice.id}`}
                className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
              >
                <span>
                  <strong>{invoice.invoiceNumber}</strong>
                  <span className="text-secondary d-block small">
                    {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
                  </span>
                </span>
                <span dir="ltr">{money(invoice.totalAmount, invoice.currency)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
