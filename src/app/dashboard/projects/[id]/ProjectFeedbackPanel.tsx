"use client"

import { CheckCircle2, MessageSquareText } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { AquaAlert, AquaBadge, AquaButton, AquaDataPanel, AquaInput, AquaSelect, AquaTextarea, aquaToast } from "@/components/aqua"

export type ProjectFeedbackView = { status: "PENDING" | "RECEIVED" | "ACTION_REQUIRED" | "RESOLVED" | "WAIVED"; npsScore: number | null; satisfactionScore: number | null; feedbackSummary: string | null; improvementNotes: string | null; testimonial: string | null; testimonialApproved: boolean; followUpRequired: boolean; followUpAction: string | null; followUpDueAt: string | null; ownerId: string | null; resolutionNote: string | null } | null

export default function ProjectFeedbackPanel({ projectId, closureStatus, feedback, members, canManage }: { projectId: string; closureStatus: string | null; feedback: ProjectFeedbackView; members: Array<{ id: string; name: string }>; canManage: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const eligible = closureStatus === "COMPLETED" || closureStatus === "ARCHIVED"
  async function mutate(payload: Record<string, unknown>) { setBusy(true); try { const response = await fetch(`/api/projects/${projectId}/feedback`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json(); if (!response.ok) throw new Error(body.message ?? "تعذر تحديث التقييم"); aquaToast.success("تم تحديث تقييم العميل"); router.refresh() } catch (error) { aquaToast.error(error instanceof Error ? error.message : "تعذر تحديث التقييم") } finally { setBusy(false) } }
  async function record(form: FormData) { const followUpRequired = form.get("followUpRequired") === "true"; await mutate({ action: "RECORD", npsScore: form.get("npsScore"), satisfactionScore: form.get("satisfactionScore"), feedbackSummary: form.get("feedbackSummary"), improvementNotes: form.get("improvementNotes"), testimonial: form.get("testimonial"), testimonialApproved: form.get("testimonialApproved") === "true", followUpRequired, followUpAction: followUpRequired ? form.get("followUpAction") : null, followUpDueAt: followUpRequired && form.get("followUpDueAt") ? new Date(String(form.get("followUpDueAt"))).toISOString() : null, ownerId: followUpRequired ? form.get("ownerId") : null }) }
  const tone = feedback?.status === "ACTION_REQUIRED" ? "warning" : feedback?.status === "RESOLVED" ? "success" : "muted"
  return <AquaDataPanel title="تقييم العميل والمتابعة" description="توثيق الرضا، فرص التحسين، موافقة الشهادة وإجراءات المتابعة بعد الإغلاق." meta={<AquaBadge variant={tone} size="sm">{feedback?.status ?? "بانتظار الإغلاق"}</AquaBadge>}>
    {!eligible ? <AquaAlert variant="info" title="التقييم بعد الإغلاق">اعتمد إغلاق المشروع أولًا حتى يصبح سجل تقييم العميل متاحًا.</AquaAlert> : null}
    {eligible ? <form action={record} className="aqua-form-stack">
      <div className="row g-3"><div className="col-md-6"><AquaInput name="npsScore" label="NPS من 0 إلى 10" type="number" min={0} max={10} defaultValue={feedback?.npsScore ?? 10} required disabled={!canManage} /></div><div className="col-md-6"><AquaInput name="satisfactionScore" label="الرضا من 1 إلى 5" type="number" min={1} max={5} defaultValue={feedback?.satisfactionScore ?? 5} required disabled={!canManage} /></div></div>
      <AquaTextarea name="feedbackSummary" label="ملخص ملاحظات العميل" defaultValue={feedback?.feedbackSummary ?? ""} minLength={10} required disabled={!canManage} />
      <AquaTextarea name="improvementNotes" label="فرص التحسين الداخلية" defaultValue={feedback?.improvementNotes ?? ""} disabled={!canManage} />
      <AquaTextarea name="testimonial" label="نص شهادة العميل (اختياري)" defaultValue={feedback?.testimonial ?? ""} disabled={!canManage} />
      <AquaSelect name="testimonialApproved" label="موافقة العميل على نشر الشهادة" defaultValue={feedback?.testimonialApproved ? "true" : "false"} disabled={!canManage}><option value="false">غير موافق / غير موثق</option><option value="true">موافقة موثقة</option></AquaSelect>
      <AquaSelect name="followUpRequired" label="هل يلزم إجراء متابعة؟" defaultValue={feedback?.followUpRequired ? "true" : "false"} disabled={!canManage}><option value="false">لا</option><option value="true">نعم</option></AquaSelect>
      <AquaTextarea name="followUpAction" label="إجراء المتابعة" defaultValue={feedback?.followUpAction ?? ""} disabled={!canManage} />
      <div className="row g-3"><div className="col-md-6"><AquaSelect name="ownerId" label="مالك المتابعة" defaultValue={feedback?.ownerId ?? ""} disabled={!canManage}><option value="">اختر عضوًا</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</AquaSelect></div><div className="col-md-6"><AquaInput name="followUpDueAt" label="موعد المتابعة" type="datetime-local" defaultValue={feedback?.followUpDueAt?.slice(0, 16) ?? ""} disabled={!canManage} /></div></div>
      {feedback?.resolutionNote ? <AquaAlert variant="success" title="نتيجة المتابعة">{feedback.resolutionNote}</AquaAlert> : null}
      {canManage ? <div className="d-flex flex-wrap gap-2"><AquaButton type="submit" leadingIcon={<MessageSquareText />} loading={busy}>حفظ التقييم</AquaButton>{feedback?.status === "ACTION_REQUIRED" ? <AquaButton type="button" variant="secondary" leadingIcon={<CheckCircle2 />} loading={busy} onClick={() => { const note = window.prompt("اكتب نتيجة المتابعة (10 أحرف على الأقل)"); if (note) void mutate({ action: "RESOLVE", resolutionNote: note }) }}>إغلاق المتابعة</AquaButton> : null}</div> : null}
    </form> : null}
  </AquaDataPanel>
}
