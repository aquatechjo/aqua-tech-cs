import type { Metadata } from 'next';
import InvoiceDocumentView from '@/components/finance/InvoiceDocumentView';
import { findClientPortalInvoice } from '@/lib/client-portal-server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'فاتورة — بوابة العميل',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default async function ClientPortalInvoicePage({
  params,
}: {
  params: Promise<{ token: string; invoiceId: string }>;
}) {
  const { token, invoiceId } = await params;
  const invoice = await findClientPortalInvoice(token, invoiceId);
  if (!invoice) {
    return (
      <main dir="rtl" className="d-flex align-items-center justify-content-center min-vh-100 p-4">
        <div className="text-center">
          <h1 className="h4">الفاتورة غير متاحة</h1>
          <p className="text-secondary">تعذر العثور على هذه الفاتورة ضمن بوابتك.</p>
        </div>
      </main>
    );
  }
  return <InvoiceDocumentView invoice={invoice} />;
}
