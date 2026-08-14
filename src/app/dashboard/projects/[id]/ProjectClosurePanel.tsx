"use client"

import { Archive, CheckCircle2, ClipboardCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { AquaAlert, AquaBadge, AquaButton, AquaDataPanel, AquaInput, AquaTextarea, aquaToast } from "@/components/aqua"

export type ProjectClosureView = {
  status: "DRAFT" | "READY_FOR_REVIEW" | "COMPLETED" | "ARCHIVED"
  outcome: "SUCCESS" | "PARTIAL_SUCCESS" | "CANCELLED" | null
  summary: string | null
  lessonsLearned: string | null
  followUpActions: string | null
  clientHandoverRef: string | null
  internalArchiveRef: string | null
  exceptionReason: string | null
} | null

type Blockers = { incompleteDeliverables: number; openChangeRequests: number; openRisks: number; openIssues: number; incompleteTasks: number }

export default function ProjectClosurePanel({ projectId, closure, blockers, canManage }: { projectId: string; closure: ProjectClosureView; blockers: Blockers; canManage: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const total = Object.values(blockers).reduce((sum, value) => sum + value, 0)

  async function submit(form: FormData, action: "SAVE_DRAFT" | "SUBMIT" | "COMPLETE" | "ARCHIVE") {
    setBusy(true)
    try {
      const payload = action === "ARCHIVE" ? { action } : {
        action,
        outcome: form.get("outcome"), summary: form.get("summary"), lessonsLearned: form.get("lessonsLearned"),
        followUpActions: form.get("followUpActions"), clientHandoverRef: form.get("clientHandoverRef"),
        internalArchiveRef: form.get("internalArchiveRef"), exceptionReason: form.get("exceptionReason"),
      }
      const response = await fetch(`/api/projects/${projectId}/closure`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message ?? "تعذر تحديث إغلاق المشروع")
      aquaToast.success("تم تحديث سجل إغلاق المشروع")
      router.refresh()
    } catch (error) { aquaToast.error(error instanceof Error ? error.message : "تعذر تحديث إغلاق المشروع") } finally { setBusy(false) }
  }

  return <AquaDataPanel className="aqua-project-panel aqua-project-closure" title="إغلاق المشروع والمراجعة الختامية" description="بوابة موثقة للتسليم، الدروس المستفادة، الاعتماد والأرشفة." meta={<AquaBadge variant={total ? "warning" : "success"} size="sm">{total ? `${total} بند مفتوح` : "جاهز للإغلاق"}</AquaBadge>}>
    {total ? <AquaAlert variant="warning" title="توجد بنود تشغيلية مفتوحة">التسليمات {blockers.incompleteDeliverables} · طلبات التغيير {blockers.openChangeRequests} · المخاطر {blockers.openRisks} · المشكلات {blockers.openIssues} · المهام {blockers.incompleteTasks}. لا يُسمح بالتجاوز دون سبب موثق.</AquaAlert> : null}
    <form action={async (form) => submit(form, "SAVE_DRAFT")} className="aqua-form-stack">
      <label>النتيجة<select className="form-select" name="outcome" defaultValue={closure?.outcome ?? "SUCCESS"} disabled={!canManage || closure?.status === "ARCHIVED"}><option value="SUCCESS">ناجح</option><option value="PARTIAL_SUCCESS">نجاح جزئي</option><option value="CANCELLED">ملغي</option></select></label>
      <AquaTextarea name="summary" label="ملخص النتيجة" defaultValue={closure?.summary ?? ""} required minLength={10} disabled={!canManage} />
      <AquaTextarea name="lessonsLearned" label="الدروس المستفادة" defaultValue={closure?.lessonsLearned ?? ""} required minLength={10} disabled={!canManage} />
      <AquaTextarea name="followUpActions" label="إجراءات المتابعة" defaultValue={closure?.followUpActions ?? ""} disabled={!canManage} />
      <AquaInput name="clientHandoverRef" label="مرجع تسليم العميل" defaultValue={closure?.clientHandoverRef ?? ""} required disabled={!canManage} />
      <AquaInput name="internalArchiveRef" label="مرجع الأرشيف الداخلي" defaultValue={closure?.internalArchiveRef ?? ""} required disabled={!canManage} />
      <AquaTextarea name="exceptionReason" label="سبب الاستثناء (عند وجود بنود مفتوحة)" defaultValue={closure?.exceptionReason ?? ""} disabled={!canManage} />
      {canManage && closure?.status !== "ARCHIVED" ? <div className="d-flex flex-wrap gap-2">
        <AquaButton type="submit" variant="secondary" loading={busy}>حفظ مسودة</AquaButton>
        {(!closure || closure.status === "DRAFT") ? <AquaButton type="submit" formAction={async (form) => submit(form, "SUBMIT")} leadingIcon={<ClipboardCheck />} loading={busy}>إرسال للمراجعة</AquaButton> : null}
        {closure?.status === "READY_FOR_REVIEW" ? <AquaButton type="submit" formAction={async (form) => submit(form, "COMPLETE")} leadingIcon={<CheckCircle2 />} loading={busy}>اعتماد الإغلاق</AquaButton> : null}
        {closure?.status === "COMPLETED" ? <AquaButton type="button" variant="secondary" leadingIcon={<Archive />} loading={busy} onClick={() => submit(new FormData(), "ARCHIVE")}>أرشفة المشروع</AquaButton> : null}
      </div> : null}
    </form>
  </AquaDataPanel>
}
