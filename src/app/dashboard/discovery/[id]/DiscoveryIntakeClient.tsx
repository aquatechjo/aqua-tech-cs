"use client"

import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  ShieldOff,
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
  AquaDetailList,
  AquaFormSection,
  AquaInput,
  AquaLinkButton,
  AquaModal,
  AquaSelect,
  AquaTabs,
  AquaTextarea,
} from "@/components/aqua"
import type { AquaBadgeProps } from "@/components/aqua"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import type {
  DiscoveryServiceTrack,
  IntakeAnswerSource,
  IntakeSessionStatus,
  LeadSource,
  LeadStatus,
  RequirementGapSeverity,
  RequirementGapStatus,
  SalesOpportunityStage,
  ServiceRequestPriority,
} from "@/generated/prisma/enums"
import {
  DISCOVERY_SERVICE_TRACKS,
  discoveryQuestionsForTrack,
  discoverySectionsForTrack,
  discoveryTrackLabel,
  type DiscoveryServiceTrackValue,
} from "@/lib/discovery-intake"

type AnswerItem = {
  id: string
  questionKey: string
  questionLabel: string
  sectionKey: string
  value: string
  source: IntakeAnswerSource
  isUnknown: boolean
  capturedAt: string
  updatedAt: string
}

type GapItem = {
  id: string
  questionKey: string
  title: string
  severity: RequirementGapSeverity
  status: RequirementGapStatus
  resolution: string | null
  resolvedAt: string | null
  resolvedBy: {
    id: string
    name: string
  } | null
  createdAt: string
  updatedAt: string
}

type SessionItem = {
  id: string
  serviceTrack: DiscoveryServiceTrack
  templateVersion: string
  status: IntakeSessionStatus
  completionScore: number
  currentSection: string | null
  internalSummary: string | null
  hasPublicLink: boolean
  publicAccessExpiresAt: string | null
  publicAccessRevokedAt: string | null
  conversationStartedAt: string | null
  conversationSubmittedAt: string | null
  conversationEscalatedAt: string | null
  lastCustomerMessageAt: string | null
  readyForReviewAt: string | null
  createdAt: string
  updatedAt: string
  lead: {
    id: string
    contactName: string
    companyName: string | null
    email: string | null
    phone: string | null
    serviceType: string
    status: LeadStatus
    source: LeadSource
    priority: ServiceRequestPriority
    nextAction: string | null
    nextActionAt: string | null
    serviceRequest: {
      id: string
      budgetRange: string | null
      timeline: string | null
      message: string | null
    } | null
  }
  opportunity: {
    id: string
    title: string
    stage: SalesOpportunityStage
  } | null
  owner: {
    id: string
    name: string
    email: string
  } | null
  answers: AnswerItem[]
  gaps: GapItem[]
  _count: {
    conversationMessages: number
  }
}

type AnswerDraft = {
  value: string
  source: IntakeAnswerSource
  isUnknown: boolean
}

const answerSources: IntakeAnswerSource[] = [
  "CUSTOMER_FACT",
  "INTERNAL_NOTE",
  "APPROVED_DECISION",
]

function sessionStatusLabel(status: IntakeSessionStatus) {
  const labels: Record<IntakeSessionStatus, string> = {
    COLLECTING: "جمع المعلومات",
    NEEDS_INFO: "تحتاج معلومات",
    READY_FOR_REVIEW: "جاهزة للمراجعة",
    COMPLETED: "مكتملة",
    ARCHIVED: "مؤرشفة",
  }

  return labels[status]
}

function sessionStatusVariant(
  status: IntakeSessionStatus,
): AquaBadgeProps["variant"] {
  if (status === "READY_FOR_REVIEW" || status === "COMPLETED") {
    return "success"
  }
  if (status === "NEEDS_INFO") return "warning"
  if (status === "ARCHIVED") return "muted"
  return "aqua"
}

function sourceLabel(source: IntakeAnswerSource) {
  const labels: Record<IntakeAnswerSource, string> = {
    CUSTOMER_FACT: "حقيقة ذكرها العميل",
    UPLOADED_EVIDENCE: "دليل مرفوع",
    AI_INFERENCE: "استنتاج ذكاء اصطناعي",
    INTERNAL_NOTE: "ملاحظة داخلية",
    APPROVED_DECISION: "قرار معتمد",
  }

  return labels[source]
}

function gapSeverityLabel(severity: RequirementGapSeverity) {
  const labels: Record<RequirementGapSeverity, string> = {
    MEDIUM: "متوسطة",
    HIGH: "عالية",
    CRITICAL: "حرجة",
  }

  return labels[severity]
}

function gapSeverityVariant(
  severity: RequirementGapSeverity,
): AquaBadgeProps["variant"] {
  if (severity === "CRITICAL") return "danger"
  if (severity === "HIGH") return "warning"
  return "blue"
}

function gapStatusLabel(status: RequirementGapStatus) {
  const labels: Record<RequirementGapStatus, string> = {
    OPEN: "مفتوحة",
    RESOLVED: "محلولة",
    WAIVED: "متجاوزة بسبب",
  }

  return labels[status]
}

function initialAnswerDrafts(
  track: DiscoveryServiceTrackValue,
  answers: readonly AnswerItem[],
) {
  const existing = new Map(
    answers.map((answer) => [answer.questionKey, answer]),
  )

  return Object.fromEntries(
    discoveryQuestionsForTrack(track).map((question) => {
      const answer = existing.get(question.key)

      return [
        question.key,
        {
          value: answer?.value ?? "",
          source: answer?.source ?? "CUSTOMER_FACT",
          isUnknown: answer?.isUnknown ?? false,
        } satisfies AnswerDraft,
      ]
    }),
  )
}

export default function DiscoveryIntakeClient({
  session,
  canManage,
  timeZone,
}: {
  session: SessionItem
  canManage: boolean
  timeZone: string
}) {
  const router = useRouter()
  const initialTrack =
    session.serviceTrack as DiscoveryServiceTrackValue
  const [serviceTrack, setServiceTrack] =
    useState<DiscoveryServiceTrackValue>(initialTrack)
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>(
    () => initialAnswerDrafts(initialTrack, session.answers),
  )
  const sections = useMemo(
    () => discoverySectionsForTrack(serviceTrack),
    [serviceTrack],
  )
  const [activeSection, setActiveSection] = useState(
    sections.some((section) => section.key === session.currentSection)
      ? (session.currentSection as string)
      : sections[0]?.key ?? "context",
  )
  const [internalSummary, setInternalSummary] = useState(
    session.internalSummary ?? "",
  )
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loadingIntent, setLoadingIntent] = useState<
    "SAVE" | "READY_FOR_REVIEW" | "REOPEN" | null
  >(null)
  const [pendingGap, setPendingGap] = useState<GapItem | null>(null)
  const [waiverReason, setWaiverReason] = useState("")
  const [gapLoading, setGapLoading] = useState(false)
  const [publicLink, setPublicLink] = useState(() => ({
    active:
      session.hasPublicLink &&
      !session.publicAccessRevokedAt &&
      Boolean(
        session.publicAccessExpiresAt &&
          new Date(session.publicAccessExpiresAt).getTime() >
            Date.now(),
      ),
    url: null as string | null,
    expiresAt: session.publicAccessExpiresAt,
  }))
  const [publicLinkLoading, setPublicLinkLoading] = useState(false)
  const [showRevokeLink, setShowRevokeLink] = useState(false)
  const questions = discoveryQuestionsForTrack(serviceTrack)
  const activeQuestions = questions.filter(
    (question) => question.sectionKey === activeSection,
  )
  const openGaps = session.gaps.filter((gap) => gap.status === "OPEN")
  const waivedGaps = session.gaps.filter((gap) => gap.status === "WAIVED")
  const resolvedGaps = session.gaps.filter(
    (gap) => gap.status === "RESOLVED",
  )
  const locked =
    session.status === "COMPLETED" || session.status === "ARCHIVED"
  const canEdit = canManage && !locked
  const formatDate = new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  })

  function updateAnswer(
    questionKey: string,
    patch: Partial<AnswerDraft>,
  ) {
    setAnswers((current) => {
      const existing = current[questionKey] ?? {
        value: "",
        source: "CUSTOMER_FACT",
        isUnknown: false,
      }

      return {
        ...current,
        [questionKey]: {
          ...existing,
          ...patch,
        },
      }
    })
  }

  function changeTrack(value: DiscoveryServiceTrackValue) {
    setServiceTrack(value)
    const nextSections = discoverySectionsForTrack(value)
    setActiveSection(nextSections[0]?.key ?? "context")
    setAnswers((current) => {
      const stored = new Map(
        session.answers.map((answer) => [answer.questionKey, answer]),
      )

      return Object.fromEntries(
        discoveryQuestionsForTrack(value).map((question) => {
          const existingDraft = current[question.key]
          const storedAnswer = stored.get(question.key)

          return [
            question.key,
            existingDraft ?? {
              value: storedAnswer?.value ?? "",
              source: storedAnswer?.source ?? "CUSTOMER_FACT",
              isUnknown: storedAnswer?.isUnknown ?? false,
            },
          ]
        }),
      )
    })
  }

  async function saveSession(
    intent: "SAVE" | "READY_FOR_REVIEW" | "REOPEN",
  ) {
    setError("")
    setSuccess("")
    setLoadingIntent(intent)

    try {
      const response = await fetch(
        `/api/discovery/sessions/${session.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            serviceTrack,
            currentSection: activeSection,
            internalSummary,
            answers: questions.map((question) => ({
              questionKey: question.key,
              value: answers[question.key]?.value ?? "",
              source:
                answers[question.key]?.source ?? "CUSTOMER_FACT",
              isUnknown:
                answers[question.key]?.isUnknown ?? false,
            })),
            intent,
          }),
        },
      )
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر حفظ جلسة جمع المتطلبات")
        return
      }

      if (
        intent === "READY_FOR_REVIEW" &&
        !data.data.readyForReview
      ) {
        setError(
          `لم تصبح الجلسة جاهزة بعد. بقيت ${data.data.blockerCount} فجوة مفتوحة.`,
        )
      } else {
        if (
          intent === "READY_FOR_REVIEW" &&
          data.data.readyForReview &&
          !session.conversationSubmittedAt
        ) {
          setPublicLink({
            active: false,
            url: null,
            expiresAt: null,
          })
        }
        setSuccess(
          intent === "READY_FOR_REVIEW"
            ? "اجتازت الجلسة بوابة الاكتمال وأصبحت جاهزة للمراجعة."
            : intent === "REOPEN"
              ? "أعيد فتح الجلسة لاستكمال التعديلات."
              : "تم حفظ الإجابات وتحديث الاكتمال والفجوات.",
        )
      }

      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setLoadingIntent(null)
    }
  }

  async function updateGap(action: "WAIVE" | "REOPEN", gap: GapItem) {
    setError("")
    setSuccess("")
    setGapLoading(true)

    try {
      const response = await fetch(
        `/api/discovery/sessions/${session.id}/gaps/${gap.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            ...(action === "WAIVE"
              ? { resolution: waiverReason }
              : {}),
          }),
        },
      )
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر معالجة فجوة المتطلبات")
        return
      }

      setSuccess(
        action === "WAIVE"
          ? "تم توثيق سبب تجاوز الفجوة."
          : "تمت إعادة فتح الفجوة.",
      )
      setPendingGap(null)
      setWaiverReason("")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setGapLoading(false)
    }
  }

  async function managePublicLink(action: "ISSUE" | "REVOKE") {
    setError("")
    setSuccess("")
    setPublicLinkLoading(true)

    try {
      const response = await fetch(
        `/api/discovery/sessions/${session.id}/public-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        },
      )
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(
          data.message || "تعذر إدارة رابط محادثة العميل",
        )
        return
      }

      const url = data.data.path
        ? new URL(data.data.path, window.location.origin).toString()
        : null

      setPublicLink({
        active: data.data.active,
        url,
        expiresAt: data.data.expiresAt,
      })
      setShowRevokeLink(false)
      setSuccess(
        action === "ISSUE"
          ? "تم إصدار رابط جديد. انسخه الآن وأرسله للعميل عبر القناة المعتمدة."
          : "تم إلغاء الرابط ولن يقبل أي وصول جديد.",
      )
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setPublicLinkLoading(false)
    }
  }

  async function copyPublicLink() {
    if (!publicLink.url) return

    try {
      await navigator.clipboard.writeText(publicLink.url)
      setSuccess("تم نسخ رابط محادثة العميل.")
    } catch {
      setError("تعذر نسخ الرابط تلقائيًا. انسخه من الحقل يدويًا.")
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <AquaPageHeader
        badge="Discovery Session"
        title={
          session.lead.companyName || session.lead.contactName
        }
        description="ملف جمع المتطلبات المنظم قبل إعداد التقرير الأولي والتسعير."
        brandValue="Discovery"
      />

      <div className="d-flex flex-wrap gap-2">
        <AquaLinkButton href="/dashboard/discovery" variant="ghost">
          رجوع إلى الجلسات
        </AquaLinkButton>
        <AquaLinkButton href="/dashboard/leads" variant="secondary">
          فتح العملاء المحتملين
        </AquaLinkButton>
        {session.opportunity ? (
          <AquaLinkButton
            href={`/dashboard/sales/opportunities/${session.opportunity.id}`}
            variant="secondary"
          >
            فتح فرصة البيع
          </AquaLinkButton>
        ) : null}
      </div>

      {error ? (
        <AquaAlert variant="danger" title="تحتاج مراجعة">
          {error}
        </AquaAlert>
      ) : null}

      {success ? (
        <AquaAlert variant="success" title="تم التحديث">
          {success}
        </AquaAlert>
      ) : null}

      {!canManage ? (
        <AquaAlert variant="info" title="وضع القراءة">
          يمكنك مراجعة جلسة الاكتشاف، لكن تعديل الإجابات والفجوات متاح
          لفريق المبيعات المخول.
        </AquaAlert>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">الحالة</div>
            <div className="mt-2">
              <AquaBadge
                variant={sessionStatusVariant(session.status)}
                dot
              >
                {sessionStatusLabel(session.status)}
              </AquaBadge>
            </div>
          </AquaCard>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">اكتمال الحقائق</div>
            <div className="h4 fw-black mb-1 mt-2" dir="ltr">
              {session.completionScore}%
            </div>
            <div className="small aqua-soft">
              لا تُحتسب الملاحظات الداخلية أو الاستنتاجات غير المعتمدة
            </div>
          </AquaCard>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">الفجوات المفتوحة</div>
            <div className="h4 fw-black mb-1 mt-2" dir="ltr">
              {openGaps.length}
            </div>
            <div className="small aqua-soft">
              {waivedGaps.length} متجاوزة بسبب موثق
            </div>
          </AquaCard>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">آخر تحديث</div>
            <div className="small fw-bold mb-1 mt-2">
              {formatDate.format(new Date(session.updatedAt))}
            </div>
            <div className="small aqua-soft" dir="ltr">
              {session.templateVersion}
            </div>
          </AquaCard>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <AquaDataPanel
            eyebrow="Guided intake"
            title="أسئلة جمع المتطلبات"
            description="احفظ تدريجيًا. اختيار «لا أعرف» يبقي السؤال كفجوة بدل اعتباره إجابة مكتملة."
            actions={
              canEdit ? (
                <AquaButton
                  size="sm"
                  leadingIcon={<Save />}
                  loading={loadingIntent === "SAVE"}
                  loadingLabel="جارٍ الحفظ"
                  onClick={() => saveSession("SAVE")}
                >
                  حفظ التقدم
                </AquaButton>
              ) : null
            }
          >
            <div className="mb-3">
              <AquaSelect
                label="مسار الخدمة"
                value={serviceTrack}
                disabled={!canEdit}
                onChange={(event) =>
                  changeTrack(
                    event.target.value as DiscoveryServiceTrackValue,
                  )
                }
              >
                {DISCOVERY_SERVICE_TRACKS.map((track) => (
                  <option key={track} value={track}>
                    {discoveryTrackLabel(track)}
                  </option>
                ))}
              </AquaSelect>
            </div>

            <AquaTabs
              items={sections.map((section) => ({
                id: section.key,
                label: section.label,
                count: questions.filter(
                  (question) => question.sectionKey === section.key,
                ).length,
              }))}
              activeId={activeSection}
              label="أقسام جمع المتطلبات"
              onChange={setActiveSection}
              className="mb-3"
            />

            <AquaFormSection
              eyebrow={`${activeQuestions.length} أسئلة`}
              title={
                sections.find(
                  (section) => section.key === activeSection,
                )?.label ?? "جمع المتطلبات"
              }
              description="اكتب ما قاله العميل بوضوح وافصل الحقيقة عن الملاحظة الداخلية."
            >
              <div className="d-flex flex-column gap-3">
                {activeQuestions.map((question) => {
                  const answer = answers[question.key] ?? {
                    value: "",
                    source: "CUSTOMER_FACT" as const,
                    isUnknown: false,
                  }
                  const relatedGap = session.gaps.find(
                    (gap) => gap.questionKey === question.key,
                  )

                  return (
                    <AquaCard
                      key={question.key}
                      variant="soft"
                      padding="sm"
                    >
                      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
                        <div className="d-flex flex-wrap gap-2">
                          {question.required ? (
                            <AquaBadge size="sm" variant="warning">
                              مطلوب
                            </AquaBadge>
                          ) : (
                            <AquaBadge size="sm" variant="muted">
                              اختياري
                            </AquaBadge>
                          )}
                          {relatedGap ? (
                            <AquaBadge
                              size="sm"
                              variant={
                                relatedGap.status === "OPEN"
                                  ? gapSeverityVariant(
                                      relatedGap.severity,
                                    )
                                  : relatedGap.status === "WAIVED"
                                    ? "muted"
                                    : "success"
                              }
                            >
                              {gapStatusLabel(relatedGap.status)}
                            </AquaBadge>
                          ) : null}
                        </div>
                        <span className="small aqua-soft" dir="ltr">
                          {question.key}
                        </span>
                      </div>

                      <AquaTextarea
                        label={question.label}
                        hint={question.hint}
                        rows={4}
                        value={answer.value}
                        disabled={!canEdit || answer.isUnknown}
                        onChange={(event) =>
                          updateAnswer(question.key, {
                            value: event.target.value,
                          })
                        }
                      />

                      <div className="row g-3 align-items-end mt-1">
                        <div className="col-12 col-lg-7">
                          <AquaSelect
                            label="نوع المعلومة"
                            value={answer.source}
                            disabled={!canEdit}
                            onChange={(event) =>
                              updateAnswer(question.key, {
                                source: event.target
                                  .value as IntakeAnswerSource,
                              })
                            }
                          >
                            {answerSources.map((source) => (
                              <option key={source} value={source}>
                                {sourceLabel(source)}
                              </option>
                            ))}
                          </AquaSelect>
                        </div>
                        <div className="col-12 col-lg-5">
                          <div className="form-check">
                            <input
                              id={`unknown-${question.key}`}
                              className="form-check-input"
                              type="checkbox"
                              checked={answer.isUnknown}
                              disabled={!canEdit}
                              onChange={(event) =>
                                updateAnswer(question.key, {
                                  isUnknown: event.target.checked,
                                  value: event.target.checked
                                    ? "لا أعرف"
                                    : answer.value === "لا أعرف"
                                      ? ""
                                      : answer.value,
                                })
                              }
                            />
                            <label
                              className="form-check-label"
                              htmlFor={`unknown-${question.key}`}
                            >
                              العميل لا يعرف الإجابة حاليًا
                            </label>
                          </div>
                        </div>
                      </div>

                      {answer.source === "INTERNAL_NOTE" ? (
                        <AquaAlert
                          variant="warning"
                          title="لا تُغلق الفجوة"
                          className="mt-3"
                        >
                          الملاحظة الداخلية لا تُعامل كحقيقة قالها العميل ولا
                          ترفع نسبة الاكتمال.
                        </AquaAlert>
                      ) : null}
                    </AquaCard>
                  )
                })}
              </div>
            </AquaFormSection>

            <div className="mt-3">
              <AquaTextarea
                label="ملخص داخلي للجلسة"
                hint="ملاحظات تشغيلية للفريق لا تُعتبر إجابات عميل ولا تدخل التقرير تلقائيًا."
                rows={4}
                value={internalSummary}
                disabled={!canEdit}
                onChange={(event) =>
                  setInternalSummary(event.target.value)
                }
              />
            </div>

            {canEdit ? (
              <div className="d-flex flex-wrap justify-content-end gap-2 mt-3">
                {session.status === "READY_FOR_REVIEW" ? (
                  <AquaButton
                    variant="secondary"
                    leadingIcon={<RotateCcw />}
                    loading={loadingIntent === "REOPEN"}
                    loadingLabel="جارٍ إعادة الفتح"
                    onClick={() => saveSession("REOPEN")}
                  >
                    إعادة فتح الجلسة
                  </AquaButton>
                ) : (
                  <>
                    <AquaButton
                      variant="secondary"
                      leadingIcon={<Save />}
                      loading={loadingIntent === "SAVE"}
                      loadingLabel="جارٍ الحفظ"
                      onClick={() => saveSession("SAVE")}
                    >
                      حفظ التقدم
                    </AquaButton>
                    <AquaButton
                      leadingIcon={<Send />}
                      loading={
                        loadingIntent === "READY_FOR_REVIEW"
                      }
                      loadingLabel="جارٍ التحقق"
                      onClick={() =>
                        saveSession("READY_FOR_REVIEW")
                      }
                    >
                      إرسال للمراجعة
                    </AquaButton>
                  </>
                )}
              </div>
            ) : null}
          </AquaDataPanel>
        </div>

        <div className="col-12 col-xl-4">
          <div className="d-flex flex-column gap-3">
            <AquaDataPanel
              eyebrow="Lead context"
              title="بيانات المصدر"
              description="مرجع سريع أثناء المحادثة؛ لا يُعد بديلًا عن إجابات الاكتشاف."
            >
              <AquaDetailList
                columns={1}
                items={[
                  {
                    label: "جهة الاتصال",
                    value: session.lead.contactName,
                  },
                  {
                    label: "الشركة",
                    value: session.lead.companyName,
                  },
                  {
                    label: "الخدمة",
                    value: session.lead.serviceType,
                  },
                  {
                    label: "التواصل",
                    value:
                      session.lead.email || session.lead.phone,
                    dir: "ltr",
                  },
                  {
                    label: "المسؤول",
                    value: session.owner?.name,
                  },
                  {
                    label: "الإجراء التالي",
                    value: session.lead.nextAction,
                  },
                  {
                    label: "الميزانية الأولية",
                    value:
                      session.lead.serviceRequest?.budgetRange,
                  },
                  {
                    label: "الإطار الزمني الأولي",
                    value: session.lead.serviceRequest?.timeline,
                  },
                ]}
              />
            </AquaDataPanel>

            <AquaDataPanel
              eyebrow="Customer conversation"
              title="رابط محادثة العميل"
              description="الرابط يحمل مفتاح وصول غير قابل للتخمين، يظهر عند الإصدار فقط، ويمكن تدويره أو إلغاؤه فورًا."
              meta={
                <AquaBadge
                  variant={
                    session.conversationSubmittedAt
                      ? "success"
                      : publicLink.active
                        ? "aqua"
                        : "muted"
                  }
                  size="sm"
                >
                  {session.conversationSubmittedAt
                    ? "أرسلها العميل"
                    : publicLink.active
                      ? "الرابط نشط"
                      : "لا يوجد رابط"}
                </AquaBadge>
              }
            >
              <AquaDetailList
                columns={1}
                items={[
                  {
                    label: "بدء العميل",
                    value: session.conversationStartedAt
                      ? formatDate.format(
                          new Date(session.conversationStartedAt),
                        )
                      : "لم يبدأ",
                  },
                  {
                    label: "الرسائل المحفوظة",
                    value: session._count.conversationMessages,
                    dir: "ltr",
                  },
                  {
                    label: "آخر إجابة",
                    value: session.lastCustomerMessageAt
                      ? formatDate.format(
                          new Date(session.lastCustomerMessageAt),
                        )
                      : "لا توجد",
                  },
                  {
                    label: "طلب مساعدة",
                    value: session.conversationEscalatedAt
                      ? "مطلوب تواصل موظف"
                      : "لا يوجد",
                  },
                  {
                    label: "انتهاء الرابط",
                    value: publicLink.expiresAt
                      ? formatDate.format(
                          new Date(publicLink.expiresAt),
                        )
                      : "—",
                  },
                ]}
              />

              {publicLink.url ? (
                <div className="mt-3">
                  <AquaInput
                    label="الرابط الجديد"
                    value={publicLink.url}
                    readOnly
                    dir="ltr"
                  />
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <AquaButton
                      size="sm"
                      leadingIcon={<Copy />}
                      onClick={copyPublicLink}
                    >
                      نسخ الرابط
                    </AquaButton>
                    <AquaLinkButton
                      href={publicLink.url}
                      target="_blank"
                      rel="noreferrer"
                      size="sm"
                      variant="secondary"
                      leadingIcon={<ExternalLink />}
                    >
                      معاينة
                    </AquaLinkButton>
                  </div>
                </div>
              ) : publicLink.active ? (
                <AquaAlert
                  variant="neutral"
                  title="الرابط الحالي مخفي"
                  className="mt-3"
                >
                  لأسباب أمنية لا يمكن استعادة قيمة الرابط بعد مغادرة
                  الصفحة. أصدر رابطًا جديدًا إذا احتجت نسخه مرة أخرى؛
                  سيُلغى الرابط السابق تلقائيًا.
                </AquaAlert>
              ) : null}

              {canEdit &&
              session.status !== "READY_FOR_REVIEW" &&
              !session.conversationSubmittedAt ? (
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <AquaButton
                    size="sm"
                    leadingIcon={<Link2 />}
                    loading={publicLinkLoading}
                    loadingLabel="جارٍ الإصدار"
                    onClick={() => managePublicLink("ISSUE")}
                  >
                    {publicLink.active
                      ? "إصدار رابط بديل"
                      : "إنشاء رابط للعميل"}
                  </AquaButton>
                  {publicLink.active ? (
                    <AquaButton
                      size="sm"
                      variant="danger"
                      leadingIcon={<ShieldOff />}
                      disabled={publicLinkLoading}
                      onClick={() => setShowRevokeLink(true)}
                    >
                      إلغاء الرابط
                    </AquaButton>
                  ) : null}
                </div>
              ) : null}
            </AquaDataPanel>

            <AquaDataPanel
              eyebrow="Requirement gaps"
              title="فجوات المتطلبات"
              description="يجب الإجابة عن الفجوة أو توثيق سبب تجاوزها قبل إرسال الجلسة للمراجعة."
              meta={
                <AquaBadge
                  variant={openGaps.length > 0 ? "warning" : "success"}
                  size="sm"
                >
                  مفتوحة {openGaps.length}
                </AquaBadge>
              }
            >
              {openGaps.length === 0 ? (
                <AquaAlert
                  variant="success"
                  title="لا توجد فجوات مفتوحة"
                  icon={<CheckCircle2 />}
                >
                  يمكنك إرسال الجلسة للمراجعة، مع بقاء التجاوزات الموثقة
                  ظاهرة للمراجع.
                </AquaAlert>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {openGaps.map((gap) => (
                    <AquaCard
                      key={gap.id}
                      variant="soft"
                      padding="sm"
                    >
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        <AquaBadge
                          size="sm"
                          variant={gapSeverityVariant(gap.severity)}
                        >
                          {gapSeverityLabel(gap.severity)}
                        </AquaBadge>
                        <AquaBadge size="sm" variant="warning">
                          مفتوحة
                        </AquaBadge>
                      </div>
                      <div className="small fw-bold">{gap.title}</div>
                      {canEdit ? (
                        <AquaButton
                          size="sm"
                          variant="ghost"
                          className="mt-2"
                          leadingIcon={<ShieldAlert />}
                          onClick={() => {
                            setPendingGap(gap)
                            setWaiverReason("")
                          }}
                        >
                          تجاوز بسبب موثق
                        </AquaButton>
                      ) : null}
                    </AquaCard>
                  ))}
                </div>
              )}

              {waivedGaps.length > 0 ? (
                <div className="mt-3">
                  <div className="small fw-bold mb-2">
                    تجاوزات موثقة
                  </div>
                  <div className="d-flex flex-column gap-2">
                    {waivedGaps.map((gap) => (
                      <AquaCard
                        key={gap.id}
                        variant="soft"
                        padding="sm"
                      >
                        <div className="small fw-bold">{gap.title}</div>
                        <div className="small aqua-muted mt-1">
                          {gap.resolution}
                        </div>
                        <div className="small aqua-soft mt-1">
                          {gap.resolvedBy?.name || "مستخدم سابق"}
                        </div>
                        {canEdit ? (
                          <AquaButton
                            size="sm"
                            variant="ghost"
                            className="mt-2"
                            leadingIcon={<RotateCcw />}
                            loading={gapLoading}
                            onClick={() => updateGap("REOPEN", gap)}
                          >
                            إعادة فتح
                          </AquaButton>
                        ) : null}
                      </AquaCard>
                    ))}
                  </div>
                </div>
              ) : null}

              {resolvedGaps.length > 0 ? (
                <div className="small aqua-soft mt-3">
                  تم حل {resolvedGaps.length} فجوة عبر إجابات موثقة.
                </div>
              ) : null}
            </AquaDataPanel>
          </div>
        </div>
      </div>

      <AquaConfirmDialog
        open={showRevokeLink}
        onClose={() => {
          if (!publicLinkLoading) setShowRevokeLink(false)
        }}
        onConfirm={() => managePublicLink("REVOKE")}
        title="إلغاء رابط محادثة العميل؟"
        description="سيتوقف الرابط الحالي فورًا ولن يستطيع العميل فتحه أو إرسال إجابات جديدة. يمكنك إصدار رابط بديل لاحقًا ما دامت الجلسة مفتوحة."
        confirmLabel="إلغاء الرابط"
        confirmVariant="danger"
        tone="danger"
        loading={publicLinkLoading}
      />

      <AquaModal
        open={Boolean(pendingGap)}
        onClose={() => {
          if (!gapLoading) {
            setPendingGap(null)
            setWaiverReason("")
          }
        }}
        title="توثيق سبب تجاوز الفجوة"
        description="استخدم التجاوز فقط عندما يتعذر الحصول على المعلومة ويوجد سبب واضح يسمح بمتابعة المراجعة."
        size="md"
        closeOnBackdrop={!gapLoading}
        footer={
          <div className="aqua-modal__action-row">
            <AquaButton
              variant="ghost"
              disabled={gapLoading}
              onClick={() => setPendingGap(null)}
            >
              إلغاء
            </AquaButton>
            <AquaButton
              loading={gapLoading}
              loadingLabel="جارٍ التوثيق"
              disabled={waiverReason.trim().length < 10}
              onClick={() =>
                pendingGap && updateGap("WAIVE", pendingGap)
              }
            >
              حفظ سبب التجاوز
            </AquaButton>
          </div>
        }
      >
        <AquaAlert variant="warning" title="قرار قابل للمراجعة">
          سيظهر السبب للمراجع ولن تُحتسب الفجوة كإجابة عميل.
        </AquaAlert>
        <AquaTextarea
          label="سبب التجاوز"
          hint="10 أحرف على الأقل: لماذا لا تتوفر المعلومة، ومن وافق على المتابعة؟"
          rows={5}
          value={waiverReason}
          onChange={(event) => setWaiverReason(event.target.value)}
        />
      </AquaModal>
    </div>
  )
}
