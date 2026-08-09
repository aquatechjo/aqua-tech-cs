"use client"

import { useEffect, useState } from "react"

export default function PublicFeedbackClient({ token, projectName, companyName }: { token: string; projectName: string; companyName: string }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { void fetch(`/api/public/feedback/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "VIEW" }) }) }, [token])
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null)
    const form = new FormData(event.currentTarget)
    const payload = { action: "SUBMIT", npsScore: form.get("npsScore"), satisfactionScore: form.get("satisfactionScore"), feedbackSummary: form.get("feedbackSummary"), testimonial: form.get("testimonial"), testimonialApproved: form.get("testimonialApproved") === "on" }
    try {
      const response = await fetch(`/api/public/feedback/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message ?? "تعذر إرسال التقييم")
      setDone(true)
    } catch (current) { setError(current instanceof Error ? current.message : "تعذر إرسال التقييم") } finally { setBusy(false) }
  }
  if (done) return <main className="aqua-proposal-public" dir="rtl"><section className="aqua-proposal-public__invalid"><div className="aqua-proposal-public__invalid-card"><p>{companyName}</p><h1>شكرًا لمشاركتنا رأيك</h1><p>تم استلام تقييمك بأمان، وسيتابع الفريق أي ملاحظات تحتاج إلى إجراء.</p></div></section></main>
  return <main className="aqua-proposal-public" dir="rtl"><section className="aqua-proposal-public__invalid"><div className="aqua-proposal-public__invalid-card"><p>{companyName}</p><h1>تقييم تجربة المشروع</h1><p>ساعدنا على تحسين عملنا من خلال تقييم مشروع «{projectName}».</p><form onSubmit={submit} className="aqua-form-stack">
    <label>ما مدى احتمالية أن توصي بنا؟ (0–10)<input className="form-control mt-2" name="npsScore" type="number" min="0" max="10" required /></label>
    <label>ما درجة رضاك عن التجربة؟ (1–5)<input className="form-control mt-2" name="satisfactionScore" type="number" min="1" max="5" required /></label>
    <label>ما أبرز ملاحظاتك؟<textarea className="form-control mt-2" name="feedbackSummary" minLength={10} maxLength={6000} rows={5} required /></label>
    <label>شهادة قصيرة عن التجربة (اختياري)<textarea className="form-control mt-2" name="testimonial" maxLength={3000} rows={3} /></label>
    <label className="d-flex gap-2 align-items-start"><input name="testimonialApproved" type="checkbox" /> أوافق على نشر نص الشهادة أعلاه باسم المشروع دون نشر بيانات تواصل.</label>
    {error ? <div className="alert alert-danger">{error}</div> : null}
    <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "جارٍ الإرسال…" : "إرسال التقييم"}</button>
  </form></div></section></main>
}
