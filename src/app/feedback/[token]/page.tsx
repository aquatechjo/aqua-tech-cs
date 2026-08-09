import type { Metadata } from "next"
import { findPublicFeedback } from "@/lib/project-feedback-public-server"
import PublicFeedbackClient from "./PublicFeedbackClient"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "تقييم مشروع Aqua Tech", description: "صفحة آمنة لإرسال تقييم المشروع.", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" }

export default async function PublicFeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const feedback = await findPublicFeedback(token)
  if (!feedback) return <main className="aqua-proposal-public" dir="rtl"><section className="aqua-proposal-public__invalid"><div className="aqua-proposal-public__invalid-card"><span className="aqua-proposal-public__status-mark">404</span><h1>رابط التقييم غير متاح</h1><p>قد يكون الرابط منتهيًا، ملغيًا، أو استُخدم لإرسال التقييم مسبقًا.</p></div></section></main>
  return <PublicFeedbackClient token={token} projectName={feedback.project.name} companyName={feedback.project.company.name} />
}
