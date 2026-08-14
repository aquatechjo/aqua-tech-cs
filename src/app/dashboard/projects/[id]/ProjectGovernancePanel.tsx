"use client"

import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Gavel,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import {
  AquaAlert,
  AquaBadge,
  AquaButton,
  AquaCard,
  AquaConfirmDialog,
  AquaDataPanel,
  AquaInput,
  AquaModal,
  AquaSelect,
  AquaTextarea,
  aquaToast,
} from "@/components/aqua"
import type { AquaBadgeVariant } from "@/design-system"
import {
  projectRiskExposure,
  projectRiskExposureBand,
  type ProjectGovernanceLevel,
} from "@/lib/project-governance"

import styles from "./ProjectGovernancePanel.module.css"

type GovernanceKind = "RISK" | "ISSUE" | "DECISION"

export type ProjectGovernanceView = {
  id: string
  referenceNumber: string
  kind: GovernanceKind
  status: string
  title: string
  description: string | null
  probability: ProjectGovernanceLevel | null
  impact: ProjectGovernanceLevel | null
  severity: ProjectGovernanceLevel | null
  responsePlan: string | null
  contingencyPlan: string | null
  trigger: string | null
  resolution: string | null
  closureNote: string | null
  decision: string | null
  rationale: string | null
  alternatives: string | null
  impactSummary: string | null
  dueDate: string | null
  decidedAt: string | null
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  ownerUser: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
  updatedBy: { id: string; name: string } | null
  decidedBy: { id: string; name: string } | null
  sourceRisk: { id: string; referenceNumber: string; title: string } | null
  materializedIssue: {
    id: string
    referenceNumber: string
    title: string
  } | null
  supersedesDecision: {
    id: string
    referenceNumber: string
    title: string
  } | null
  supersededByDecision: {
    id: string
    referenceNumber: string
    title: string
  } | null
}

type MemberOption = { id: string; name: string }
type EditorMode = "CREATE" | "EDIT" | "MATERIALIZE" | "SUPERSEDE"
type EditorState = {
  mode: EditorMode
  kind: GovernanceKind
  item: ProjectGovernanceView | null
} | null
type LifecycleAction =
  | "RESOLVE_ISSUE"
  | "CLOSE_ISSUE"
  | "REOPEN_ISSUE"
  | "CLOSE_RISK"
  | "REOPEN_RISK"
type LifecycleState = {
  item: ProjectGovernanceView
  action: LifecycleAction
  note: string
} | null

const kindCopy: Record<
  GovernanceKind,
  { label: string; description: string; icon: React.ReactNode }
> = {
  RISK: {
    label: "المخاطر",
    description: "احتمالات قد تؤثر على الوقت أو النطاق أو الجودة.",
    icon: <AlertTriangle aria-hidden="true" />,
  },
  ISSUE: {
    label: "المشكلات",
    description: "أحداث واقعة تحتاج مالكًا ومعالجة موثقة.",
    icon: <CircleAlert aria-hidden="true" />,
  },
  DECISION: {
    label: "القرارات",
    description: "قرارات ثابتة مع السبب والأثر وتاريخ الاستبدال.",
    icon: <Gavel aria-hidden="true" />,
  },
}

const levelLabels: Record<ProjectGovernanceLevel, string> = {
  LOW: "منخفض",
  MEDIUM: "متوسط",
  HIGH: "عالٍ",
  CRITICAL: "حرج",
}

const statusLabels: Record<string, string> = {
  OPEN: "مفتوح",
  MONITORING: "تحت المراقبة",
  MITIGATED: "مخفف",
  MATERIALIZED: "تحول إلى مشكلة",
  IN_PROGRESS: "قيد المعالجة",
  RESOLVED: "محلول",
  CLOSED: "مغلق",
  RECORDED: "مسجل",
  SUPERSEDED: "مستبدل",
}

function statusVariant(status: string): AquaBadgeVariant {
  if (["MITIGATED", "RESOLVED", "RECORDED"].includes(status)) return "success"
  if (["MONITORING", "IN_PROGRESS"].includes(status)) return "warning"
  if (["MATERIALIZED", "SUPERSEDED", "CLOSED"].includes(status)) return "muted"
  return "danger"
}

function levelVariant(level: ProjectGovernanceLevel): AquaBadgeVariant {
  if (level === "CRITICAL") return "danger"
  if (level === "HIGH") return "warning"
  if (level === "MEDIUM") return "blue"
  return "muted"
}

function dateOnly(value: string | null) {
  return value?.slice(0, 10) ?? "—"
}

function errorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message
  }
  return fallback
}

function formText(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim()
}

function optionalFormText(form: FormData, key: string) {
  return formText(form, key) || null
}

export default function ProjectGovernancePanel({
  projectId,
  items,
  members,
  canManage,
  projectClosed,
}: {
  projectId: string
  items: ProjectGovernanceView[]
  members: MemberOption[]
  canManage: boolean
  projectClosed: boolean
}) {
  const router = useRouter()
  const [activeKind, setActiveKind] = useState<GovernanceKind>("RISK")
  const [editor, setEditor] = useState<EditorState>(null)
  const [lifecycle, setLifecycle] = useState<LifecycleState>(null)
  const [confirmLifecycle, setConfirmLifecycle] =
    useState<LifecycleState>(null)
  const [busyKey, setBusyKey] = useState("")

  const grouped = useMemo(
    () => ({
      RISK: items.filter((item) => item.kind === "RISK"),
      ISSUE: items.filter((item) => item.kind === "ISSUE"),
      DECISION: items.filter((item) => item.kind === "DECISION"),
    }),
    [items],
  )
  const visibleItems = grouped[activeKind]

  async function mutate(
    key: string,
    endpoint: string,
    method: "POST" | "PATCH",
    body: Record<string, unknown>,
    message: string,
  ) {
    setBusyKey(key)
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = (await response.json().catch(() => null)) as unknown
      if (!response.ok) {
        throw new Error(errorMessage(payload, "تعذر تنفيذ الإجراء"))
      }
      aquaToast.success(message)
      router.refresh()
      return true
    } catch (error) {
      aquaToast.error(
        error instanceof Error ? error.message : "حدث خطأ غير متوقع",
      )
      return false
    } finally {
      setBusyKey("")
    }
  }

  function openCreate(kind: GovernanceKind) {
    setActiveKind(kind)
    setEditor({ mode: "CREATE", kind, item: null })
  }

  async function submitEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor) return
    const form = new FormData(event.currentTarget)
    const common = {
      title: formText(form, "title"),
    }

    let endpoint = `/api/projects/${projectId}/governance`
    let method: "POST" | "PATCH" = "POST"
    let body: Record<string, unknown>
    let message: string

    if (editor.mode === "MATERIALIZE" && editor.item) {
      endpoint += `/${editor.item.id}`
      method = "PATCH"
      body = {
        action: "MATERIALIZE_RISK",
        issueTitle: common.title,
        issueDescription: formText(form, "description"),
        severity: formText(form, "severity"),
        ownerUserId: optionalFormText(form, "ownerUserId"),
        dueDate: optionalFormText(form, "dueDate"),
      }
      message = "تم تحويل الخطر إلى مشكلة مرتبطة"
    } else if (editor.mode === "SUPERSEDE" && editor.item) {
      endpoint += `/${editor.item.id}`
      method = "PATCH"
      body = {
        action: "SUPERSEDE_DECISION",
        ...common,
        decision: formText(form, "decision"),
        rationale: formText(form, "rationale"),
        alternatives: optionalFormText(form, "alternatives"),
        impactSummary: optionalFormText(form, "impactSummary"),
      }
      message = "تم تسجيل القرار البديل وحفظ القرار السابق"
    } else if (editor.kind === "RISK") {
      body = {
        ...(editor.mode === "EDIT"
          ? { action: "UPDATE_RISK", status: formText(form, "status") }
          : { kind: "RISK" }),
        ...common,
        description: formText(form, "description"),
        probability: formText(form, "probability"),
        impact: formText(form, "impact"),
        responsePlan: formText(form, "responsePlan"),
        contingencyPlan: optionalFormText(form, "contingencyPlan"),
        trigger: optionalFormText(form, "trigger"),
        ownerUserId: optionalFormText(form, "ownerUserId"),
        dueDate: optionalFormText(form, "dueDate"),
      }
      if (editor.mode === "EDIT" && editor.item) {
        endpoint += `/${editor.item.id}`
        method = "PATCH"
      }
      message = editor.mode === "EDIT" ? "تم تحديث الخطر" : "تم تسجيل الخطر"
    } else if (editor.kind === "ISSUE") {
      body = {
        ...(editor.mode === "EDIT"
          ? { action: "UPDATE_ISSUE", status: formText(form, "status") }
          : { kind: "ISSUE" }),
        ...common,
        description: formText(form, "description"),
        severity: formText(form, "severity"),
        ownerUserId: optionalFormText(form, "ownerUserId"),
        dueDate: optionalFormText(form, "dueDate"),
      }
      if (editor.mode === "EDIT" && editor.item) {
        endpoint += `/${editor.item.id}`
        method = "PATCH"
      }
      message = editor.mode === "EDIT" ? "تم تحديث المشكلة" : "تم تسجيل المشكلة"
    } else {
      body = {
        kind: "DECISION",
        ...common,
        decision: formText(form, "decision"),
        rationale: formText(form, "rationale"),
        alternatives: optionalFormText(form, "alternatives"),
        impactSummary: optionalFormText(form, "impactSummary"),
      }
      message = "تم تسجيل القرار"
    }

    const saved = await mutate(
      `governance-${editor.mode.toLowerCase()}`,
      endpoint,
      method,
      body,
      message,
    )
    if (saved) setEditor(null)
  }

  function lifecycleCopy(action: LifecycleAction) {
    const copy: Record<
      LifecycleAction,
      { title: string; label: string; description: string }
    > = {
      RESOLVE_ISSUE: {
        title: "توثيق حل المشكلة",
        label: "تفاصيل الحل",
        description: "سيتحول السجل إلى محلول مع حفظ وقت المعالجة.",
      },
      CLOSE_ISSUE: {
        title: "إغلاق المشكلة",
        label: "ملاحظة الإغلاق",
        description: "الإغلاق نهائي حتى تتم إعادة فتح المشكلة بقرار موثق.",
      },
      REOPEN_ISSUE: {
        title: "إعادة فتح المشكلة",
        label: "سبب إعادة الفتح",
        description: "سيُمسح الحل السابق من الحالة التشغيلية ويبقى في سجل النشاط.",
      },
      CLOSE_RISK: {
        title: "إغلاق الخطر",
        label: "ملاحظة الإغلاق",
        description: "لن يظهر الخطر ضمن المخاطر النشطة بعد الإغلاق.",
      },
      REOPEN_RISK: {
        title: "إعادة فتح الخطر",
        label: "سبب إعادة الفتح",
        description: "سيعود الخطر إلى الحالة المفتوحة للمراقبة والمعالجة.",
      },
    }
    return copy[action]
  }

  async function applyLifecycle() {
    if (!confirmLifecycle) return
    const { item, action, note } = confirmLifecycle
    const field = action === "RESOLVE_ISSUE"
      ? "resolution"
      : action.startsWith("CLOSE_")
        ? "closureNote"
        : "note"
    const saved = await mutate(
      `governance-${action.toLowerCase()}-${item.id}`,
      `/api/projects/${projectId}/governance/${item.id}`,
      "PATCH",
      { action, [field]: note },
      action === "RESOLVE_ISSUE"
        ? "تم توثيق حل المشكلة"
        : action.startsWith("CLOSE_")
          ? "تم إغلاق السجل"
          : "تمت إعادة فتح السجل",
    )
    if (saved) setConfirmLifecycle(null)
  }

  const editorTitle = editor
    ? editor.mode === "MATERIALIZE"
      ? "تحويل الخطر إلى مشكلة"
      : editor.mode === "SUPERSEDE"
        ? "تسجيل قرار بديل"
        : editor.mode === "EDIT"
          ? `تعديل ${editor.kind === "RISK" ? "الخطر" : "المشكلة"}`
          : `تسجيل ${editor.kind === "RISK" ? "خطر" : editor.kind === "ISSUE" ? "مشكلة" : "قرار"}`
    : ""

  return (
    <>
      <AquaDataPanel
        className="aqua-project-panel aqua-project-governance"
        title="سجل حوكمة المشروع"
        description="مخاطر ومشكلات وقرارات مرتبطة بسياق التنفيذ وأثر تدقيق واضح."
        meta={
          <div className={styles.summaryBadges}>
            <AquaBadge variant="warning" size="sm">
              {grouped.RISK.filter((item) => !["CLOSED", "MATERIALIZED"].includes(item.status)).length} مخاطر نشطة
            </AquaBadge>
            <AquaBadge variant="danger" size="sm">
              {grouped.ISSUE.filter((item) => !["RESOLVED", "CLOSED"].includes(item.status)).length} مشكلات مفتوحة
            </AquaBadge>
            <AquaBadge variant="blue" size="sm">
              {grouped.DECISION.filter((item) => item.status === "RECORDED").length} قرارات نافذة
            </AquaBadge>
          </div>
        }
        actions={
          canManage && !projectClosed ? (
            <AquaButton
              size="sm"
              leadingIcon={<Plus />}
              onClick={() => openCreate(activeKind)}
            >
              تسجيل {activeKind === "RISK" ? "خطر" : activeKind === "ISSUE" ? "مشكلة" : "قرار"}
            </AquaButton>
          ) : null
        }
      >
        <div className={styles.tabs} role="tablist" aria-label="أنواع سجل الحوكمة">
          {(Object.keys(kindCopy) as GovernanceKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={activeKind === kind}
              className={activeKind === kind ? styles.tabActive : styles.tab}
              onClick={() => setActiveKind(kind)}
            >
              {kindCopy[kind].icon}
              <span>{kindCopy[kind].label}</span>
              <bdi dir="ltr">{grouped[kind].length}</bdi>
            </button>
          ))}
        </div>

        <p className={styles.kindDescription}>{kindCopy[activeKind].description}</p>

        {visibleItems.length === 0 ? (
          <div className={styles.empty}>
            <ShieldAlert aria-hidden="true" />
            <strong>لا توجد سجلات في هذا القسم.</strong>
            <span>سجّل أول بند عندما يظهر أثر يحتاج متابعة أو قرارًا موثقًا.</span>
          </div>
        ) : (
          <div className={styles.grid}>
            {visibleItems.map((item) => {
              const exposure =
                item.kind === "RISK" && item.probability && item.impact
                  ? projectRiskExposure(item.probability, item.impact)
                  : null
              const exposureBand = exposure
                ? projectRiskExposureBand(exposure)
                : null
              return (
                <AquaCard key={item.id} padding="sm" className={styles.itemCard}>
                  <div className={styles.itemHeader}>
                    <div>
                      <span className={styles.reference} dir="ltr">
                        {item.referenceNumber}
                      </span>
                      <h3>{item.title}</h3>
                    </div>
                    <AquaBadge variant={statusVariant(item.status)} size="sm">
                      {statusLabels[item.status] ?? item.status}
                    </AquaBadge>
                  </div>

                  {item.description ? <p>{item.description}</p> : null}

                  <dl className={styles.details}>
                    {exposure !== null && exposureBand ? (
                      <>
                        <div><dt>التعرض</dt><dd><AquaBadge variant={levelVariant(exposureBand)} size="sm">{levelLabels[exposureBand]} · <bdi dir="ltr">{exposure}/16</bdi></AquaBadge></dd></div>
                        <div><dt>الاحتمال / الأثر</dt><dd>{levelLabels[item.probability!]} / {levelLabels[item.impact!]}</dd></div>
                      </>
                    ) : null}
                    {item.severity ? <div><dt>الشدة</dt><dd><AquaBadge variant={levelVariant(item.severity)} size="sm">{levelLabels[item.severity]}</AquaBadge></dd></div> : null}
                    {item.ownerUser ? <div><dt>المسؤول</dt><dd>{item.ownerUser.name}</dd></div> : null}
                    <div><dt>الموعد</dt><dd dir="ltr">{dateOnly(item.dueDate)}</dd></div>
                    {item.sourceRisk ? <div><dt>ناتجة عن</dt><dd><span dir="ltr">{item.sourceRisk.referenceNumber}</span> · {item.sourceRisk.title}</dd></div> : null}
                    {item.materializedIssue ? <div><dt>المشكلة الناتجة</dt><dd><span dir="ltr">{item.materializedIssue.referenceNumber}</span> · {item.materializedIssue.title}</dd></div> : null}
                    {item.supersedesDecision ? <div><dt>يستبدل</dt><dd><span dir="ltr">{item.supersedesDecision.referenceNumber}</span> · {item.supersedesDecision.title}</dd></div> : null}
                    {item.supersededByDecision ? <div><dt>استُبدل بـ</dt><dd><span dir="ltr">{item.supersededByDecision.referenceNumber}</span> · {item.supersededByDecision.title}</dd></div> : null}
                    {item.decidedBy ? <div><dt>صاحب القرار</dt><dd>{item.decidedBy.name}</dd></div> : null}
                  </dl>

                  {item.responsePlan ? <div className={styles.note}><strong>خطة الاستجابة</strong><span>{item.responsePlan}</span></div> : null}
                  {item.resolution ? <div className={styles.note}><strong>الحل</strong><span>{item.resolution}</span></div> : null}
                  {item.decision ? <div className={styles.note}><strong>القرار</strong><span>{item.decision}</span></div> : null}
                  {item.rationale ? <div className={styles.note}><strong>السبب</strong><span>{item.rationale}</span></div> : null}

                  {canManage && !projectClosed ? (
                    <div className={styles.actions}>
                      {item.kind === "RISK" && ["OPEN", "MONITORING", "MITIGATED"].includes(item.status) ? (
                        <>
                          <AquaButton size="sm" variant="secondary" leadingIcon={<Pencil />} onClick={() => setEditor({ mode: "EDIT", kind: "RISK", item })}>تعديل</AquaButton>
                          <AquaButton size="sm" variant="secondary" leadingIcon={<CircleAlert />} onClick={() => setEditor({ mode: "MATERIALIZE", kind: "ISSUE", item })}>تحول لمشكلة</AquaButton>
                          <AquaButton size="sm" variant="ghost" onClick={() => setLifecycle({ item, action: "CLOSE_RISK", note: "" })}>إغلاق</AquaButton>
                        </>
                      ) : null}
                      {item.kind === "RISK" && item.status === "CLOSED" ? <AquaButton size="sm" variant="secondary" leadingIcon={<RefreshCcw />} onClick={() => setLifecycle({ item, action: "REOPEN_RISK", note: "" })}>إعادة فتح</AquaButton> : null}
                      {item.kind === "ISSUE" && ["OPEN", "IN_PROGRESS"].includes(item.status) ? (
                        <>
                          <AquaButton size="sm" variant="secondary" leadingIcon={<Pencil />} onClick={() => setEditor({ mode: "EDIT", kind: "ISSUE", item })}>تعديل</AquaButton>
                          <AquaButton size="sm" leadingIcon={<CheckCircle2 />} onClick={() => setLifecycle({ item, action: "RESOLVE_ISSUE", note: "" })}>توثيق الحل</AquaButton>
                        </>
                      ) : null}
                      {item.kind === "ISSUE" && item.status === "RESOLVED" ? (
                        <>
                          <AquaButton size="sm" variant="secondary" onClick={() => setLifecycle({ item, action: "CLOSE_ISSUE", note: "" })}>إغلاق</AquaButton>
                          <AquaButton size="sm" variant="ghost" leadingIcon={<RefreshCcw />} onClick={() => setLifecycle({ item, action: "REOPEN_ISSUE", note: "" })}>إعادة فتح</AquaButton>
                        </>
                      ) : null}
                      {item.kind === "ISSUE" && item.status === "CLOSED" ? <AquaButton size="sm" variant="secondary" leadingIcon={<RefreshCcw />} onClick={() => setLifecycle({ item, action: "REOPEN_ISSUE", note: "" })}>إعادة فتح</AquaButton> : null}
                      {item.kind === "DECISION" && item.status === "RECORDED" ? <AquaButton size="sm" variant="secondary" leadingIcon={<Gavel />} onClick={() => setEditor({ mode: "SUPERSEDE", kind: "DECISION", item })}>تسجيل قرار بديل</AquaButton> : null}
                    </div>
                  ) : null}
                </AquaCard>
              )
            })}
          </div>
        )}
      </AquaDataPanel>

      <AquaModal
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={editorTitle}
        description={editor?.mode === "SUPERSEDE" ? "سيبقى القرار السابق محفوظًا ويُعلّم كمستبدل." : "أدخل المعلومات التشغيلية المطلوبة للسجل."}
        size="lg"
      >
        {editor ? (
          <form className={styles.form} onSubmit={submitEditor}>
            <AquaInput name="title" label="العنوان" required defaultValue={editor.mode === "MATERIALIZE" ? editor.item?.title ?? "" : editor.mode === "SUPERSEDE" ? "" : editor.item?.title ?? ""} />

            {(editor.kind === "RISK" && editor.mode !== "MATERIALIZE") ? (
              <>
                <AquaTextarea name="description" label="وصف الخطر" required rows={3} defaultValue={editor.item?.description ?? ""} />
                <div className={styles.formGrid}>
                  <AquaSelect name="probability" label="الاحتمال" defaultValue={editor.item?.probability ?? "MEDIUM"}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</AquaSelect>
                  <AquaSelect name="impact" label="الأثر" defaultValue={editor.item?.impact ?? "MEDIUM"}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</AquaSelect>
                </div>
                {editor.mode === "EDIT" ? <AquaSelect name="status" label="الحالة" defaultValue={editor.item?.status ?? "OPEN"}><option value="OPEN">مفتوح</option><option value="MONITORING">تحت المراقبة</option><option value="MITIGATED">مخفف</option></AquaSelect> : null}
                <AquaTextarea name="responsePlan" label="خطة الاستجابة" required rows={3} defaultValue={editor.item?.responsePlan ?? ""} />
                <AquaTextarea name="contingencyPlan" label="خطة الطوارئ" rows={2} defaultValue={editor.item?.contingencyPlan ?? ""} />
                <AquaInput name="trigger" label="مؤشر التحقق أو المحفز" defaultValue={editor.item?.trigger ?? ""} />
              </>
            ) : null}

            {(editor.kind === "ISSUE" || editor.mode === "MATERIALIZE") ? (
              <>
                <AquaTextarea name="description" label="وصف المشكلة" required rows={3} defaultValue={editor.mode === "MATERIALIZE" ? `تحقق الخطر ${editor.item?.referenceNumber ?? ""}: ${editor.item?.description ?? ""}` : editor.item?.description ?? ""} />
                <AquaSelect name="severity" label="الشدة" defaultValue={editor.item?.severity ?? editor.item?.impact ?? "HIGH"}>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</AquaSelect>
                {editor.mode === "EDIT" ? <AquaSelect name="status" label="الحالة" defaultValue={editor.item?.status ?? "OPEN"}><option value="OPEN">مفتوح</option><option value="IN_PROGRESS">قيد المعالجة</option></AquaSelect> : null}
              </>
            ) : null}

            {editor.kind !== "DECISION" ? (
              <div className={styles.formGrid}>
                <AquaSelect name="ownerUserId" label="المسؤول" defaultValue={editor.item?.ownerUser?.id ?? ""}><option value="">غير معيّن</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</AquaSelect>
                <AquaInput name="dueDate" type="date" label="موعد المتابعة" defaultValue={dateOnly(editor.item?.dueDate ?? null) === "—" ? "" : dateOnly(editor.item?.dueDate ?? null)} />
              </div>
            ) : null}

            {editor.kind === "DECISION" ? (
              <>
                <AquaTextarea name="decision" label="نص القرار" required rows={3} />
                <AquaTextarea name="rationale" label="مبررات القرار" required rows={3} />
                <AquaTextarea name="alternatives" label="البدائل التي نوقشت" rows={2} />
                <AquaTextarea name="impactSummary" label="الأثر المتوقع" rows={2} />
              </>
            ) : null}

            <div className={styles.formActions}>
              <AquaButton type="button" variant="ghost" onClick={() => setEditor(null)}>إلغاء</AquaButton>
              <AquaButton type="submit" loading={busyKey.startsWith("governance-")}>{editor.mode === "EDIT" ? "حفظ التعديل" : editor.mode === "MATERIALIZE" ? "إنشاء المشكلة" : editor.mode === "SUPERSEDE" ? "تسجيل البديل" : "تسجيل"}</AquaButton>
            </div>
          </form>
        ) : null}
      </AquaModal>

      <AquaModal
        open={lifecycle !== null}
        onClose={() => setLifecycle(null)}
        title={lifecycle ? lifecycleCopy(lifecycle.action).title : ""}
        description={lifecycle ? lifecycleCopy(lifecycle.action).description : ""}
        size="md"
      >
        {lifecycle ? (
          <div className={styles.form}>
            <AquaTextarea label={lifecycleCopy(lifecycle.action).label} required rows={4} value={lifecycle.note} onChange={(event) => setLifecycle({ ...lifecycle, note: event.target.value })} />
            {lifecycle.note.trim().length > 0 && lifecycle.note.trim().length < 3 ? <AquaAlert variant="warning">اكتب ملاحظة من ثلاثة أحرف على الأقل.</AquaAlert> : null}
            <div className={styles.formActions}>
              <AquaButton variant="ghost" onClick={() => setLifecycle(null)}>إلغاء</AquaButton>
              <AquaButton disabled={lifecycle.note.trim().length < 3} onClick={() => { setConfirmLifecycle(lifecycle); setLifecycle(null) }}>متابعة</AquaButton>
            </div>
          </div>
        ) : null}
      </AquaModal>

      <AquaConfirmDialog
        open={confirmLifecycle !== null}
        title={confirmLifecycle ? lifecycleCopy(confirmLifecycle.action).title : "تأكيد الإجراء"}
        description={confirmLifecycle ? lifecycleCopy(confirmLifecycle.action).description : ""}
        confirmLabel="تأكيد الإجراء"
        cancelLabel="رجوع"
        tone={confirmLifecycle?.action.startsWith("CLOSE_") ? "danger" : "warning"}
        loading={busyKey.startsWith("governance-")}
        onClose={() => setConfirmLifecycle(null)}
        onConfirm={applyLifecycle}
      />
    </>
  )
}
