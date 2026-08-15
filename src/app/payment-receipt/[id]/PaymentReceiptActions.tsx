"use client"

import Link from "next/link"

export default function PaymentReceiptActions({ invoiceId }: { invoiceId: string }) {
  return <div className="d-flex justify-content-center gap-2 p-3 d-print-none"><Link className="btn btn-outline-info" href={`/dashboard/finance/invoices/${invoiceId}`}>الرجوع للفاتورة</Link><button className="btn btn-info fw-bold" type="button" onClick={() => window.print()}>طباعة / حفظ PDF</button></div>
}
