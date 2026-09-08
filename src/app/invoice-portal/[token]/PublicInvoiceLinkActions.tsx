'use client';

export default function PublicInvoiceLinkActions() {
  return (
    <button
      className="btn btn-info fw-bold d-print-none"
      type="button"
      onClick={() => window.print()}
    >
      طباعة / حفظ PDF
    </button>
  );
}
