"use client"

import {
  Bot,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileClock,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  AquaAlert,
  AquaBadge,
  AquaButton,
  AquaCard,
  AquaConfirmDialog,
  AquaDataPanel,
  AquaDetailList,
  AquaFormSection,
  AquaLinkButton,
  AquaModal,
  AquaTextarea,
} from "@/components/aqua"
import type { AquaBadgeProps } from "@/components/aqua"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import type {
  DiscoveryReportStatus,
  DiscoveryReportVersionOrigin,
  DiscoveryServiceTrack,
  IntakeSessionStatus,
  SalesOpportunityStage,
} from "@/generated/prisma/enums"
import {
  discoveryReportLines,
  isDiscoveryReportEvidenceStale,
  parseDiscoveryReportLines,
  type DiscoveryReportContent,
} from "@/lib/discovery-report"
import { discoveryTrackLabel } from "@/lib/discovery-intake"

type SessionItem = {
  id: string
  status: IntakeSessionStatus
  serviceTrack: DiscoveryServiceTrack
  completionScore: number
  lead: {
    id: string
    serviceType: string
  }
  opportunity: {
    id: string
    stage: SalesOpportunityStage
  } | null
}

type ReportItem = {
  id: string
  status: DiscoveryReportStatus
  currentVersion: number
  reviewNotes: string | null
  aiAuthorizedAt: string | null
  submittedAt: string | null
  changesRequestedAt: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  createdBy: {
    id: string
    name: string
  } | null
  reviewedBy: {
    id: string
    name: string
  } | null
  versions: Array<{
    id: string
    version: number
    origin: DiscoveryReportVersionOrigin
    content: DiscoveryReportContent | null
    evidenceInputHash: string
    promptVersion: string | null
    aiProvider: string | null
    aiModel: string | null
    createdAt: string
    createdBy: {
      id: string
      name: string
    } | null
  }>
}

function reportStatusLabel(status: DiscoveryReportStatus) {
  const labels: Record<DiscoveryReportStatus, string> = {
    DRAFT: "مسودة",
    IN_REVIEW: "قيد المراجعة",
    CHANGES_REQUESTED: "تحتاج تعديلات",
    APPROVED: "معتمدة",
  }

  return labels[status]
}

function reportStatusVariant(
  status: DiscoveryReportStatus,
): AquaBadgeProps["variant"] {
  if (status === "APPROVED") return "success"
  if (status === "IN_REVIEW") return "blue"
  if (status === "CHANGES_REQUESTED") return "warning"
  return "aqua"
}

function originLabel(origin: DiscoveryReportVersionOrigin) {
  return origin === "AI_DRAFT"
    ? "مسودة ذكاء اصطناعي"
    : "مراجعة بشرية"
}

function risksToText(content: DiscoveryReportContent) {
  return content.risks
    .map(
      (risk) =>
        `${risk.title} | ${risk.impact} | ${risk.mitigation}`,
    )
    .join("\n")
}

function risksFromText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title = "", impact = "", ...mitigationParts] =
        line.split("|").map((part) => part.trim())

      return {
        title,
        impact,
        mitigation: mitigationParts.join(" | "),
      }
    })
}

export default function DiscoveryReportClient({
  session,
  displayName,
  report,
  initialContent,
  currentVersionOrigin,
  currentVersionEvidenceHash,
  currentEvidenceHash,
  canManage,
  canApprove,
  aiConfigured,
  aiModel,
  timeZone,
}: {
  session: SessionItem
  displayName: string
  report: ReportItem | null
  initialContent: DiscoveryReportContent
  currentVersionOrigin: DiscoveryReportVersionOrigin | null
  currentVersionEvidenceHash: string | null
  currentEvidenceHash: string
  canManage: boolean
  canApprove: boolean
  aiConfigured: boolean
  aiModel: string
  timeZone: string
}) {
  const router = useRouter()
  const [content, setContent] =
    useState<DiscoveryReportContent>(initialContent)
  const [externalAiConfirmed, setExternalAiConfirmed] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loadingAction, setLoadingAction] = useState<
    "GENERATE" | "SAVE" | "SUBMIT" | "REQUEST_CHANGES" | "APPROVE" | null
  >(null)
  const [showApprove, setShowApprove] = useState(false)
  const [showChanges, setShowChanges] = useState(false)
  const [reviewNotes, setReviewNotes] = useState("")
  const [previewVersion, setPreviewVersion] = useState<
    ReportItem["versions"][number] | null
  >(null)
  const status = report?.status ?? "DRAFT"
  const reportLocked =
    status === "IN_REVIEW" || status === "APPROVED"
  const sessionReady = session.status === "READY_FOR_REVIEW"
  const stale = isDiscoveryReportEvidenceStale({
    versionEvidenceHash: currentVersionEvidenceHash,
    currentEvidenceHash,
  })
  const canEdit = canManage && sessionReady && !reportLocked
  const currentHumanVersion =
    currentVersionOrigin === "HUMAN_REVISION"
  const formatDate = new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  })

  function updateContent(patch: Partial<DiscoveryReportContent>) {
    setContent((current) => ({
      ...current,
      ...patch,
    }))
  }

  async function runRequest({
    action,
    url,
    method,
    body,
    successMessage,
  }: {
    action: NonNullable<typeof loadingAction>
    url: string
    method: "POST" | "PATCH"
    body: unknown
    successMessage: string
  }) {
    setError("")
    setSuccess("")
    setLoadingAction(action)

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر تنفيذ الإجراء")
        return false
      }

      setSuccess(successMessage)
      router.refresh()
      return true
    } catch {
      setError("تعذر الاتصال بالخادم")
      return false
    } finally {
      setLoadingAction(null)
    }
  }

  async function generateReport() {
    await runRequest({
      action: "GENERATE",
      url: `/api/discovery/sessions/${session.id}/report/generate`,
      method: "POST",
      body: {
        confirmExternalAiProcessing: externalAiConfirmed,
      },
      successMessage:
        "تم إنشاء مسودة AI جديدة. راجعها واحفظ إصدارًا بشريًا قبل إرسالها.",
    })
  }

  async function saveHumanVersion() {
    await runRequest({
      action: "SAVE",
      url: `/api/discovery/sessions/${session.id}/report`,
      method: "PATCH",
      body: content,
      successMessage:
        "تم حفظ إصدار بشري مستقل من تقرير الاكتشاف.",
    })
  }

  async function reviewAction(
    action: "SUBMIT" | "REQUEST_CHANGES" | "APPROVE",
  ) {
    const completed = await runRequest({
      action:
        action === "SUBMIT"
          ? "SUBMIT"
          : action === "APPROVE"
            ? "APPROVE"
            : "REQUEST_CHANGES",
      url: `/api/discovery/sessions/${session.id}/report/review`,
      method: "POST",
      body: {
        action,
        ...(action === "REQUEST_CHANGES"
          ? { notes: reviewNotes }
          : {}),
      },
      successMessage:
        action === "SUBMIT"
          ? "أُرسل التقرير للمراجعة."
          : action === "APPROVE"
            ? "تم اعتماد التقرير وإكمال مرحلة الاكتشاف."
            : "تم توثيق التعديلات المطلوبة وإعادة التقرير للتحرير.",
    })

    if (completed) {
      setShowApprove(false)
      setShowChanges(false)
      setReviewNotes("")
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <AquaPageHeader
        badge="Discovery Report"
        title={`تقرير اكتشاف — ${displayName}`}
        description="مسودة قائمة على الأدلة، ثم إصدار بشري ومراجعة واعتماد قبل التسعير."
        brandValue="Report Review"
      />

      <div className="d-flex flex-wrap gap-2">
        <AquaLinkButton
          href={`/dashboard/discovery/${session.id}`}
          variant="ghost"
        >
          رجوع إلى الجلسة
        </AquaLinkButton>
        <AquaLinkButton href="/dashboard/discovery" variant="secondary">
          كل جلسات الاكتشاف
        </AquaLinkButton>
      </div>

      {error ? (
        <AquaAlert variant="danger" title="تعذر التنفيذ">
          {error}
        </AquaAlert>
      ) : null}

      {success ? (
        <AquaAlert variant="success" title="تم التحديث">
          {success}
        </AquaAlert>
      ) : null}

      {!sessionReady && status !== "APPROVED" ? (
        <AquaAlert variant="warning" title="الجلسة غير جاهزة">
          أغلق فجوات المتطلبات وأرسل جلسة الاكتشاف للمراجعة قبل إنشاء
          التقرير أو تعديله.
        </AquaAlert>
      ) : null}

      {stale ? (
        <AquaAlert variant="warning" title="الإصدار يحتاج تحديثًا">
          تغيرت أدلة الاكتشاف بعد حفظ هذا الإصدار. راجع المحتوى واحفظ
          إصدارًا بشريًا جديدًا قبل الإرسال أو الاعتماد.
        </AquaAlert>
      ) : null}

      {report?.reviewNotes ? (
        <AquaAlert variant="warning" title="تعديلات مطلوبة">
          {report.reviewNotes}
        </AquaAlert>
      ) : null}

      {status === "APPROVED" ? (
        <AquaAlert
          variant="success"
          title="تقرير الاكتشاف معتمد"
          icon={<CheckCircle2 />}
        >
          أُغلقت مرحلة الاكتشاف، والخطوة التالية هي مراجعة النطاق
          والتسعير البشري قبل إنشاء العرض المركزي.
        </AquaAlert>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">حالة التقرير</div>
            <div className="mt-2">
              <AquaBadge variant={reportStatusVariant(status)} dot>
                {reportStatusLabel(status)}
              </AquaBadge>
            </div>
          </AquaCard>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">الإصدار الحالي</div>
            <div className="h4 fw-black mb-1 mt-2" dir="ltr">
              {report?.currentVersion ?? 0}
            </div>
            <div className="small aqua-soft">
              {currentVersionOrigin
                ? originLabel(currentVersionOrigin)
                : "لم يُحفظ إصدار بعد"}
            </div>
          </AquaCard>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">اكتمال الأدلة</div>
            <div className="h4 fw-black mb-1 mt-2" dir="ltr">
              {session.completionScore}%
            </div>
            <div className="small aqua-soft">
              {stale ? "تغيرت بعد الإصدار" : "متزامنة مع الإصدار"}
            </div>
          </AquaCard>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">مسار الخدمة</div>
            <div className="small fw-bold mb-1 mt-2">
              {discoveryTrackLabel(session.serviceTrack)}
            </div>
            <div className="small aqua-soft" dir="ltr">
              {session.opportunity?.stage ?? "NO OPPORTUNITY"}
            </div>
          </AquaCard>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <AquaDataPanel
            eyebrow="Evidence-based draft"
            title="محتوى تقرير الاكتشاف"
            description="راجع كل صياغة. لا يمثل التقرير سعرًا أو عرضًا أو التزامًا نهائيًا."
          >
            <div className="d-flex flex-column gap-3">
              <AquaFormSection
                eyebrow="Context"
                title="السياق والمشكلة"
                description="لخّص الوضع اعتمادًا على ما ثبت في جلسة الاكتشاف."
              >
                <div className="d-flex flex-column gap-3">
                  <AquaTextarea
                    label="الملخص التنفيذي"
                    rows={5}
                    value={content.executiveSummary}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateContent({
                        executiveSummary: event.target.value,
                      })
                    }
                  />
                  <AquaTextarea
                    label="المشكلة الحالية"
                    rows={4}
                    value={content.problemStatement}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateContent({
                        problemStatement: event.target.value,
                      })
                    }
                  />
                  <AquaTextarea
                    label="الوضع الحالي"
                    rows={4}
                    value={content.currentState}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateContent({
                        currentState: event.target.value,
                      })
                    }
                  />
                </div>
              </AquaFormSection>

              <AquaFormSection
                eyebrow="Outcome and scope"
                title="النتائج والنطاق المقترح"
                description="عنصر واحد في كل سطر. النطاق هنا أساس للمراجعة وليس تسعيرًا."
              >
                <div className="d-flex flex-column gap-3">
                  <AquaTextarea
                    label="النتائج المطلوبة"
                    hint="عنصر واحد في كل سطر"
                    rows={5}
                    value={discoveryReportLines(content.desiredOutcomes)}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateContent({
                        desiredOutcomes: parseDiscoveryReportLines(
                          event.target.value,
                        ),
                      })
                    }
                  />
                  <AquaTextarea
                    label="المنهج المقترح"
                    rows={5}
                    value={content.recommendedApproach}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateContent({
                        recommendedApproach: event.target.value,
                      })
                    }
                  />
                  <AquaTextarea
                    label="عناصر النطاق"
                    hint="عنصر واحد في كل سطر"
                    rows={7}
                    value={discoveryReportLines(content.scopeItems)}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateContent({
                        scopeItems: parseDiscoveryReportLines(
                          event.target.value,
                        ),
                      })
                    }
                  />
                  <AquaTextarea
                    label="مقاييس النجاح"
                    hint="مقياس واحد في كل سطر"
                    rows={5}
                    value={discoveryReportLines(content.successMeasures)}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateContent({
                        successMeasures: parseDiscoveryReportLines(
                          event.target.value,
                        ),
                      })
                    }
                  />
                </div>
              </AquaFormSection>

              <AquaFormSection
                eyebrow="Guardrails"
                title="القيود والمخاطر والافتراضات"
                description="اجعل عدم اليقين ظاهرًا بدل تحويله إلى حقيقة."
              >
                <div className="d-flex flex-column gap-3">
                  <AquaTextarea
                    label="القيود"
                    hint="قيد واحد في كل سطر"
                    rows={4}
                    value={discoveryReportLines(content.constraints)}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateContent({
                        constraints: parseDiscoveryReportLines(
                          event.target.value,
                        ),
                      })
                    }
                  />
                  <AquaTextarea
                    label="المخاطر"
                    hint="كل سطر: الخطر | الأثر | المعالجة المقترحة"
                    rows={6}
                    value={risksToText(content)}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateContent({
                        risks: risksFromText(event.target.value),
                      })
                    }
                  />
                  <AquaTextarea
                    label="الافتراضات"
                    hint="افتراض واحد في كل سطر"
                    rows={4}
                    value={discoveryReportLines(content.assumptions)}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateContent({
                        assumptions: parseDiscoveryReportLines(
                          event.target.value,
                        ),
                      })
                    }
                  />
                  <AquaTextarea
                    label="الأسئلة المفتوحة"
                    hint="سؤال واحد في كل سطر"
                    rows={4}
                    value={discoveryReportLines(content.openQuestions)}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateContent({
                        openQuestions: parseDiscoveryReportLines(
                          event.target.value,
                        ),
                      })
                    }
                  />
                  <AquaTextarea
                    label="الخطوة التالية الموصى بها"
                    rows={3}
                    value={content.recommendedNextStep}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateContent({
                        recommendedNextStep: event.target.value,
                      })
                    }
                  />
                </div>
              </AquaFormSection>
            </div>
          </AquaDataPanel>
        </div>

        <div className="col-12 col-xl-4">
          <div className="d-flex flex-column gap-3">
            <AquaDataPanel
              eyebrow="AI draft"
              title="توليد مسودة منظمة"
              description="يُرسل الحد الأدنى من الأدلة المنظمة فقط، ولا تُرسل بيانات الاتصال أو المحادثة الخام أو الملاحظات الداخلية."
              meta={
                <AquaBadge
                  variant={aiConfigured ? "success" : "warning"}
                  size="sm"
                >
                  {aiConfigured ? "مهيأ" : "غير مهيأ"}
                </AquaBadge>
              }
            >
              <AquaDetailList
                columns={1}
                items={[
                  {
                    label: "المزود",
                    value: "OpenAI Responses API",
                  },
                  {
                    label: "النموذج",
                    value: aiModel,
                    dir: "ltr",
                  },
                  {
                    label: "تخزين استجابة المزود",
                    value: "معطل",
                  },
                  {
                    label: "حد التوليد",
                    value: "5 مرات في الساعة للجلسة",
                  },
                ]}
              />

              {!aiConfigured ? (
                <AquaAlert
                  variant="warning"
                  title="يلزم إعداد الخادم"
                  className="mt-3"
                >
                  أضف متغير البيئة OPENAI_API_KEY قبل استخدام التوليد.
                  يمكن للفريق بدء التقرير وحفظه يدويًا دون هذا التكامل.
                </AquaAlert>
              ) : null}

              {canEdit ? (
                <>
                  <div className="form-check mt-3">
                    <input
                      id="external-ai-processing"
                      className="form-check-input"
                      type="checkbox"
                      checked={externalAiConfirmed}
                      onChange={(event) =>
                        setExternalAiConfirmed(event.target.checked)
                      }
                    />
                    <label
                      className="form-check-label"
                      htmlFor="external-ai-processing"
                    >
                      أؤكد وجود أساس معتمد لمعالجة هذه الأدلة عبر مزود AI
                      الخارجي.
                    </label>
                  </div>

                  <AquaButton
                    className="mt-3"
                    fullWidth
                    leadingIcon={<Bot />}
                    loading={loadingAction === "GENERATE"}
                    loadingLabel="جارٍ توليد المسودة"
                    disabled={
                      !aiConfigured || !externalAiConfirmed
                    }
                    onClick={generateReport}
                  >
                    {report
                      ? "توليد إصدار AI جديد"
                      : "توليد المسودة الأولى"}
                  </AquaButton>
                </>
              ) : null}
            </AquaDataPanel>

            <AquaDataPanel
              eyebrow="Human gate"
              title="المراجعة والاعتماد"
              description="لا يمكن إرسال مخرجات AI مباشرة؛ يجب حفظ إصدار بشري أولًا."
            >
              {canEdit ? (
                <div className="d-grid gap-2">
                  <AquaButton
                    variant="secondary"
                    leadingIcon={<Save />}
                    loading={loadingAction === "SAVE"}
                    loadingLabel="جارٍ حفظ الإصدار"
                    onClick={saveHumanVersion}
                  >
                    حفظ إصدار بشري
                  </AquaButton>

                  {currentHumanVersion &&
                  (status === "DRAFT" ||
                    status === "CHANGES_REQUESTED") ? (
                    <AquaButton
                      leadingIcon={<Send />}
                      loading={loadingAction === "SUBMIT"}
                      loadingLabel="جارٍ الإرسال"
                      disabled={stale}
                      onClick={() => reviewAction("SUBMIT")}
                    >
                      إرسال للمراجعة
                    </AquaButton>
                  ) : null}
                </div>
              ) : null}

              {status === "IN_REVIEW" && canApprove ? (
                <div className="d-grid gap-2">
                  <AquaButton
                    leadingIcon={<ShieldCheck />}
                    onClick={() => setShowApprove(true)}
                  >
                    اعتماد التقرير
                  </AquaButton>
                  <AquaButton
                    variant="secondary"
                    leadingIcon={<FileClock />}
                    onClick={() => setShowChanges(true)}
                  >
                    طلب تعديلات
                  </AquaButton>
                </div>
              ) : null}

              {!canManage && status !== "IN_REVIEW" ? (
                <AquaAlert variant="info" title="وضع القراءة">
                  يمكنك مراجعة التقرير والإصدارات، لكن التحرير متاح لفريق
                  المبيعات المخول.
                </AquaAlert>
              ) : null}

              {currentVersionOrigin === "AI_DRAFT" ? (
                <AquaAlert
                  variant="warning"
                  title="المراجعة البشرية مطلوبة"
                  className="mt-3"
                >
                  راجع الحقول ثم اضغط «حفظ إصدار بشري». لن يقبل النظام
                  إرسال مسودة AI مباشرة للاعتماد.
                </AquaAlert>
              ) : null}
            </AquaDataPanel>

            <AquaDataPanel
              eyebrow="Version history"
              title="سجل الإصدارات"
              description="كل توليد أو حفظ ينشئ إصدارًا جديدًا ويحافظ على السابق."
              meta={
                <AquaBadge size="sm" variant="muted">
                  {report?.versions.length ?? 0} إصدارات
                </AquaBadge>
              }
            >
              {report?.versions.length ? (
                <div className="d-flex flex-column gap-2">
                  {report.versions.map((version) => (
                    <AquaCard
                      key={version.id}
                      variant="soft"
                      padding="sm"
                    >
                      <div className="d-flex flex-wrap justify-content-between gap-2">
                        <div className="d-flex flex-wrap gap-2">
                          <AquaBadge
                            size="sm"
                            variant={
                              version.origin === "HUMAN_REVISION"
                                ? "success"
                                : "blue"
                            }
                          >
                            v{version.version}
                          </AquaBadge>
                          <AquaBadge size="sm" variant="muted">
                            {originLabel(version.origin)}
                          </AquaBadge>
                          {version.version === report.currentVersion ? (
                            <AquaBadge size="sm" variant="aqua">
                              الحالي
                            </AquaBadge>
                          ) : null}
                        </div>
                        <span className="small aqua-soft">
                          {formatDate.format(
                            new Date(version.createdAt),
                          )}
                        </span>
                      </div>
                      <div className="small mt-2">
                        {version.createdBy?.name ?? "النظام"}
                      </div>
                      {version.aiModel ? (
                        <div className="small aqua-soft mt-1" dir="ltr">
                          {version.aiProvider} · {version.aiModel}
                        </div>
                      ) : null}
                      {version.content ? (
                        <AquaButton
                          size="sm"
                          variant="ghost"
                          className="mt-2"
                          leadingIcon={<Eye />}
                          onClick={() => setPreviewVersion(version)}
                        >
                          عرض هذا الإصدار
                        </AquaButton>
                      ) : null}
                    </AquaCard>
                  ))}
                </div>
              ) : (
                <AquaAlert
                  variant="neutral"
                  title="لا توجد إصدارات"
                  icon={<FileCheck2 />}
                >
                  ولّد مسودة AI أو املأ الحقول ثم احفظ إصدارًا بشريًا.
                </AquaAlert>
              )}
            </AquaDataPanel>
          </div>
        </div>
      </div>

      <AquaConfirmDialog
        open={showApprove}
        onClose={() => setShowApprove(false)}
        onConfirm={() => reviewAction("APPROVE")}
        title="اعتماد تقرير الاكتشاف؟"
        description="سيُثبت الإصدار الحالي، تُغلق مرحلة الاكتشاف، ويصبح الإجراء التالي مراجعة النطاق والتسعير. لا ينشئ هذا الإجراء عرضًا أو سعرًا تلقائيًا."
        confirmLabel="اعتماد التقرير"
        loading={loadingAction === "APPROVE"}
        tone="neutral"
      />

      <AquaModal
        open={showChanges}
        onClose={() => {
          if (loadingAction !== "REQUEST_CHANGES") {
            setShowChanges(false)
          }
        }}
        title="طلب تعديلات على التقرير"
        description="اكتب ملاحظات واضحة تبقى ظاهرة لمحرر الإصدار التالي."
        size="sm"
        closeOnBackdrop={loadingAction !== "REQUEST_CHANGES"}
        footer={
          <div className="aqua-modal__action-row">
            <AquaButton
              variant="ghost"
              disabled={loadingAction === "REQUEST_CHANGES"}
              onClick={() => setShowChanges(false)}
            >
              إلغاء
            </AquaButton>
            <AquaButton
              leadingIcon={<FileClock />}
              loading={loadingAction === "REQUEST_CHANGES"}
              loadingLabel="جارٍ طلب التعديلات"
              onClick={() => reviewAction("REQUEST_CHANGES")}
            >
              توثيق التعديلات
            </AquaButton>
          </div>
        }
      >
        <AquaTextarea
          label="ملاحظات المراجع"
          rows={6}
          value={reviewNotes}
          onChange={(event) => setReviewNotes(event.target.value)}
        />
      </AquaModal>

      <AquaModal
        open={Boolean(previewVersion)}
        onClose={() => setPreviewVersion(null)}
        title={`معاينة الإصدار ${previewVersion?.version ?? ""}`}
        description={
          previewVersion
            ? originLabel(previewVersion.origin)
            : undefined
        }
        size="lg"
      >
        {previewVersion?.content ? (
          <div className="d-flex flex-column gap-3">
            <AquaCard variant="soft" padding="sm">
              <h3 className="h6 fw-black">الملخص التنفيذي</h3>
              <p className="mb-0">{previewVersion.content.executiveSummary}</p>
            </AquaCard>
            <AquaCard variant="soft" padding="sm">
              <h3 className="h6 fw-black">المشكلة والوضع الحالي</h3>
              <p>{previewVersion.content.problemStatement}</p>
              <p className="mb-0">{previewVersion.content.currentState}</p>
            </AquaCard>
            <AquaCard variant="soft" padding="sm">
              <h3 className="h6 fw-black">النتائج والنطاق</h3>
              <ul className="mb-3">
                {previewVersion.content.desiredOutcomes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>{previewVersion.content.recommendedApproach}</p>
              <ul className="mb-0">
                {previewVersion.content.scopeItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </AquaCard>
            <AquaCard variant="soft" padding="sm">
              <h3 className="h6 fw-black">المخاطر والأسئلة المفتوحة</h3>
              <ul className="mb-3">
                {previewVersion.content.risks.map((risk) => (
                  <li key={`${risk.title}-${risk.impact}`}>
                    <strong>{risk.title}:</strong> {risk.impact} —{" "}
                    {risk.mitigation}
                  </li>
                ))}
              </ul>
              <ul className="mb-0">
                {previewVersion.content.openQuestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </AquaCard>
            <AquaAlert variant="info" title="الخطوة التالية">
              {previewVersion.content.recommendedNextStep}
            </AquaAlert>
          </div>
        ) : null}
      </AquaModal>
    </div>
  )
}
