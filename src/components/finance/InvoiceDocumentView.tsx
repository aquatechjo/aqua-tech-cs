import AquaSystemDocument from '@/components/aqua/AquaSystemDocument';

function money(value: { toString(): string }, currency: string) {
  return `${Number(value.toString()).toLocaleString('en-JO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}
function day(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? '—';
}

type InvoiceDocumentInput = {
  invoiceNumber: string;
  issueDate: Date | null;
  dueDate: Date | null;
  currency: string;
  totalAmount: { toString(): string };
  amountPaid: { toString(): string };
  subtotal: { toString(): string };
  taxAmount: { toString(): string };
  notes: string | null;
  terms: string | null;
  company: { name: string; email: string | null };
  project: { name: string; code: string } | null;
  client: { name: string } | null;
  items: {
    id: string;
    description: string;
    quantity: { toString(): string };
    unitPrice: { toString(): string };
    lineTotal: { toString(): string };
  }[];
};

export default function InvoiceDocumentView({
  invoice,
  actions,
}: {
  invoice: InvoiceDocumentInput;
  actions?: React.ReactNode;
}) {
  const outstanding = Math.max(
    0,
    Number(invoice.totalAmount.toString()) - Number(invoice.amountPaid.toString()),
  );
  return (
    <main className="py-3 aqua-client-invoice" dir="rtl" data-public-invoice>
      {actions ? <div className="d-flex justify-content-center p-3">{actions}</div> : null}
      <AquaSystemDocument
        title="فاتورة"
        documentLabel="Invoice"
        reference={invoice.invoiceNumber}
        issuedAt={day(invoice.issueDate)}
        density="compact"
        footerNote={`صادرة عن ${invoice.company.name} — لا تُعد إيصال دفع`}
      >
        <div className="row g-3 mb-4">
          <div className="col-6">
            <div className="small text-secondary">العميل</div>
            <strong>{invoice.client?.name ?? '—'}</strong>
          </div>
          <div className="col-6 text-start">
            <div className="small text-secondary">المشروع</div>
            <strong>{invoice.project?.name ?? '—'}</strong>
            <div className="small" dir="ltr">
              {invoice.project?.code ?? '—'}
            </div>
          </div>
        </div>
        <div className="row g-3 mb-4">
          <div className="col-4">
            <span className="small text-secondary d-block">تاريخ الإصدار</span>
            <strong dir="ltr">{day(invoice.issueDate)}</strong>
          </div>
          <div className="col-4">
            <span className="small text-secondary d-block">الاستحقاق</span>
            <strong dir="ltr">{day(invoice.dueDate)}</strong>
          </div>
          <div className="col-4">
            <span className="small text-secondary d-block">رقم الفاتورة</span>
            <strong dir="ltr">{invoice.invoiceNumber}</strong>
          </div>
        </div>
        <table className="table align-middle border">
          <thead>
            <tr>
              <th>#</th>
              <th>البيان</th>
              <th className="text-start">الكمية</th>
              <th className="text-start">سعر الوحدة</th>
              <th className="text-start">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.description}</td>
                <td className="text-start" dir="ltr">
                  {item.quantity.toString()}
                </td>
                <td className="text-start" dir="ltr">
                  {money(item.unitPrice, invoice.currency)}
                </td>
                <td className="text-start" dir="ltr">
                  {money(item.lineTotal, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row justify-content-end mt-4">
          <div className="col-12 col-md-6">
            <div className="d-flex justify-content-between">
              <span>المجموع الفرعي</span>
              <strong dir="ltr">{money(invoice.subtotal, invoice.currency)}</strong>
            </div>
            <div className="d-flex justify-content-between">
              <span>الضريبة</span>
              <strong dir="ltr">{money(invoice.taxAmount, invoice.currency)}</strong>
            </div>
            <hr />
            <div className="d-flex justify-content-between h5">
              <span>الإجمالي</span>
              <strong dir="ltr">{money(invoice.totalAmount, invoice.currency)}</strong>
            </div>
            <div className="d-flex justify-content-between">
              <span>المدفوع</span>
              <strong dir="ltr">{money(invoice.amountPaid, invoice.currency)}</strong>
            </div>
            <div className="d-flex justify-content-between">
              <span>المتبقي</span>
              <strong dir="ltr">
                {outstanding.toLocaleString('en-JO', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {invoice.currency}
              </strong>
            </div>
          </div>
        </div>
        {invoice.notes ? (
          <section className="mt-4">
            <h2 className="h6">ملاحظات</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{invoice.notes}</p>
          </section>
        ) : null}
        {invoice.terms ? (
          <section className="mt-3">
            <h2 className="h6">الشروط</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{invoice.terms}</p>
          </section>
        ) : null}
        <p className="small text-secondary mt-4">
          للاستفسار: <span dir="ltr">{invoice.company.email ?? 'info.aquatech.jo@gmail.com'}</span>
        </p>
      </AquaSystemDocument>
    </main>
  );
}
