"use client"

import {
  ArrowUp,
  CheckCircle2,
  CircleHelp,
  Pencil,
  Send,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  AquaAlert,
  AquaBadge,
  AquaButton,
  AquaCard,
  AquaMark,
  AquaTextarea,
} from "@/components/aqua"
import type {
  DiscoveryQuestion,
  DiscoveryServiceTrackValue,
} from "@/lib/discovery-intake"

type ConversationMessage = {
  id: string
  role: "SYSTEM" | "CUSTOMER"
  kind:
    | "INTRODUCTION"
    | "QUESTION"
    | "ANSWER"
    | "SUMMARY"
    | "ESCALATION"
    | "COMPLETION"
  questionKey: string | null
  content: string
  sequence: number
  createdAt: string
}

type PublicAnswer = {
  questionKey: string
  questionLabel: string
  sectionLabel: string
  value: string
  isUnknown: boolean
  updatedAt: string
}

type PublicDiscoveryState = {
  contactName: string
  companyName: string | null
  serviceType: string
  serviceTrack: DiscoveryServiceTrackValue
  serviceTrackLabel: string
  phase: "CONSENT" | "QUESTIONS" | "SUMMARY" | "SUBMITTED"
  responseProgress: number
  verifiedCompletionScore: number
  nextQuestion: DiscoveryQuestion | null
  answers: PublicAnswer[]
  messages: ConversationMessage[]
  startedAt: string | null
  submittedAt: string | null
  escalatedAt: string | null
  expiresAt: string | null
}

type ConversationAction =
  | {
      action: "START"
      privacyConsent: true
      contactConfirmed: true
    }
  | {
      action: "ANSWER"
      questionKey: string
      value: string
      isUnknown: boolean
    }
  | {
      action: "ESCALATE"
      reason: string
    }
  | {
      action: "CONFIRM"
    }

export default function PublicDiscoveryConversation({
  token,
  initialState,
}: {
  token: string
  initialState: PublicDiscoveryState
}) {
  const [session, setSession] = useState(initialState)
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [contactConfirmed, setContactConfirmed] = useState(false)
  const [answerValue, setAnswerValue] = useState("")
  const [editingAnswer, setEditingAnswer] =
    useState<PublicAnswer | null>(null)
  const [escalationReason, setEscalationReason] = useState("")
  const [showEscalation, setShowEscalation] = useState(false)
  const [loadingAction, setLoadingAction] = useState<
    ConversationAction["action"] | null
  >(null)
  const [error, setError] = useState("")
  const messageEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    })
  }, [session.messages.length])

  async function sendAction(payload: ConversationAction) {
    setError("")
    setLoadingAction(payload.action)

    try {
      const response = await fetch(
        `/api/public/discovery/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      )
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر حفظ إجابتك")
        return false
      }

      setSession(data.data)
      return true
    } catch {
      setError("تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجددًا.")
      return false
    } finally {
      setLoadingAction(null)
    }
  }

  async function startConversation() {
    if (!privacyConsent || !contactConfirmed) {
      setError("أكد هويتك ووافق على حفظ الإجابات للمتابعة.")
      return
    }

    await sendAction({
      action: "START",
      privacyConsent: true,
      contactConfirmed: true,
    })
  }

  async function submitAnswer(isUnknown = false) {
    const questionKey =
      editingAnswer?.questionKey ?? session.nextQuestion?.key

    if (!questionKey) return

    if (!isUnknown && answerValue.trim().length < 2) {
      setError("اكتب إجابة واضحة أو اختر «لا أعرف حاليًا».")
      return
    }

    const saved = await sendAction({
      action: "ANSWER",
      questionKey,
      value: isUnknown ? "" : answerValue,
      isUnknown,
    })

    if (saved) {
      setAnswerValue("")
      setEditingAnswer(null)
    }
  }

  async function requestHelp() {
    if (escalationReason.trim().length < 10) {
      setError("اشرح النقطة التي تحتاج مساعدة فيها بعبارة قصيرة.")
      return
    }

    const saved = await sendAction({
      action: "ESCALATE",
      reason: escalationReason,
    })

    if (saved) {
      setEscalationReason("")
      setShowEscalation(false)
    }
  }

  function beginEdit(answer: PublicAnswer) {
    setEditingAnswer(answer)
    setAnswerValue(answer.isUnknown ? "" : answer.value)
    setError("")
  }

  const activeQuestion = editingAnswer
    ? {
        key: editingAnswer.questionKey,
        label: editingAnswer.questionLabel,
        hint: "عدّل الإجابة ثم احفظها للعودة إلى الملخص.",
      }
    : session.nextQuestion

  return (
    <main className="aqua-discovery-public">
      <div className="aqua-discovery-public__shell">
        <header className="aqua-discovery-public__header">
          <AquaMark size="sm" showTagline={false} />
          <div className="aqua-discovery-public__header-meta">
            <AquaBadge variant="aqua" size="sm">
              Discovery
            </AquaBadge>
            <span>جلسة آمنة لجمع المتطلبات</span>
          </div>
        </header>

        <section className="aqua-discovery-public__intro">
          <div>
            <span className="aqua-discovery-public__eyebrow">
              {session.serviceTrackLabel}
            </span>
            <h1>
              أهلًا {session.contactName.split(/\s+/u)[0]}
            </h1>
            <p>
              سنجمع صورة واضحة عن احتياجك قبل أن يراجع فريق Aqua Tech
              النطاق والخطوة التالية.
            </p>
          </div>
          <div className="aqua-discovery-public__progress-card">
            <div>
              <span>تقدم المحادثة</span>
              <strong dir="ltr">{session.responseProgress}%</strong>
            </div>
            <progress
              max="100"
              value={session.responseProgress}
              aria-label={`تقدم المحادثة ${session.responseProgress}%`}
            />
            <small>
              يمكنك إغلاق الصفحة والعودة من الرابط نفسه قبل انتهاء صلاحيته.
            </small>
          </div>
        </section>

        {error ? (
          <AquaAlert
            variant="danger"
            title="تعذر إكمال الخطوة"
            className="mb-3"
          >
            {error}
          </AquaAlert>
        ) : null}

        {session.escalatedAt && session.phase !== "SUBMITTED" ? (
          <AquaAlert
            variant="info"
            title="طلب المساعدة مسجل"
            className="mb-3"
          >
            يمكنك متابعة الإجابات، وسيبقى طلب تواصل الموظف ظاهرًا للفريق.
          </AquaAlert>
        ) : null}

        {session.phase === "CONSENT" ? (
          <AquaCard
            variant="surface"
            padding="lg"
            className="aqua-discovery-public__consent"
          >
            <div className="aqua-discovery-public__section-heading">
              <span>قبل أن نبدأ</span>
              <h2>تأكيد بسيط لحماية معلوماتك</h2>
              <p>
                تحفظ الإجابات داخل نظام Aqua Tech ليستخدمها الفريق في
                فهم الطلب وإعداد المراجعة الأولية. لا يُنشأ سعر أو التزام
                تعاقدي تلقائيًا من هذه الإجابات.
              </p>
            </div>

            <label className="aqua-discovery-public__check">
              <input
                type="checkbox"
                checked={contactConfirmed}
                onChange={(event) =>
                  setContactConfirmed(event.target.checked)
                }
              />
              <span>
                أؤكد أنني {session.contactName} أو مخول بتعبئة هذه
                المتطلبات نيابة عن الجهة.
              </span>
            </label>

            <label className="aqua-discovery-public__check">
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={(event) =>
                  setPrivacyConsent(event.target.checked)
                }
              />
              <span>
                أوافق على حفظ إجاباتي واستخدامها لمراجعة طلب الخدمة
                والتواصل معي بخصوصه.
              </span>
            </label>

            <AquaButton
              fullWidth
              size="lg"
              leadingIcon={<ArrowUp />}
              loading={loadingAction === "START"}
              loadingLabel="جارٍ بدء الجلسة"
              onClick={startConversation}
            >
              ابدأ جلسة الاكتشاف
            </AquaButton>
          </AquaCard>
        ) : null}

        {session.phase !== "CONSENT" ? (
          <div className="aqua-discovery-public__workspace">
            <section
              className="aqua-discovery-public__conversation"
              aria-label="سجل المحادثة"
            >
              {session.messages.map((message) => (
                <article
                  key={message.id}
                  className={`aqua-discovery-public__message aqua-discovery-public__message--${message.role.toLowerCase()}`}
                >
                  <span>
                    {message.role === "SYSTEM"
                      ? "Aqua Tech"
                      : "إجابتك"}
                  </span>
                  <p>{message.content}</p>
                </article>
              ))}
              <div ref={messageEndRef} />
            </section>

            {session.phase === "QUESTIONS" || editingAnswer ? (
              <AquaCard
                variant="surface"
                padding="md"
                className="aqua-discovery-public__composer"
              >
                <div className="aqua-discovery-public__section-heading">
                  <span>
                    {editingAnswer
                      ? "تعديل الإجابة"
                      : session.nextQuestion?.sectionLabel}
                  </span>
                  <h2>{activeQuestion?.label}</h2>
                  <p>{activeQuestion?.hint}</p>
                </div>

                <AquaTextarea
                  label="إجابتك"
                  rows={5}
                  value={answerValue}
                  maxLength={12000}
                  disabled={loadingAction !== null}
                  placeholder="اكتب التفاصيل التي تعرفها بوضوح..."
                  onChange={(event) => setAnswerValue(event.target.value)}
                />

                <div className="aqua-discovery-public__composer-actions">
                  {editingAnswer ? (
                    <AquaButton
                      variant="ghost"
                      disabled={loadingAction !== null}
                      onClick={() => {
                        setEditingAnswer(null)
                        setAnswerValue("")
                      }}
                    >
                      إلغاء التعديل
                    </AquaButton>
                  ) : (
                    <AquaButton
                      variant="ghost"
                      disabled={loadingAction !== null}
                      onClick={() => submitAnswer(true)}
                    >
                      لا أعرف حاليًا
                    </AquaButton>
                  )}
                  <AquaButton
                    leadingIcon={<Send />}
                    loading={loadingAction === "ANSWER"}
                    loadingLabel="جارٍ الحفظ"
                    onClick={() => submitAnswer(false)}
                  >
                    {editingAnswer ? "حفظ التعديل" : "حفظ ومتابعة"}
                  </AquaButton>
                </div>
              </AquaCard>
            ) : null}

            {session.phase === "SUMMARY" && !editingAnswer ? (
              <AquaCard
                variant="surface"
                padding="md"
                className="aqua-discovery-public__summary"
              >
                <div className="aqua-discovery-public__section-heading">
                  <span>الخطوة الأخيرة</span>
                  <h2>راجع إجاباتك قبل الإرسال</h2>
                  <p>
                    عدّل أي معلومة غير دقيقة. الإجابات التي اخترت لها
                    «لا أعرف» ستظهر للفريق كنقاط تحتاج متابعة.
                  </p>
                </div>

                <div className="aqua-discovery-public__answers">
                  {session.answers.map((answer) => (
                    <article key={answer.questionKey}>
                      <div>
                        <span>{answer.sectionLabel}</span>
                        <h3>{answer.questionLabel}</h3>
                        <p>
                          {answer.isUnknown
                            ? "لا أعرف حاليًا"
                            : answer.value}
                        </p>
                      </div>
                      <AquaButton
                        size="sm"
                        variant="ghost"
                        leadingIcon={<Pencil />}
                        onClick={() => beginEdit(answer)}
                      >
                        تعديل
                      </AquaButton>
                    </article>
                  ))}
                </div>

                <AquaButton
                  fullWidth
                  size="lg"
                  leadingIcon={<CheckCircle2 />}
                  loading={loadingAction === "CONFIRM"}
                  loadingLabel="جارٍ الإرسال"
                  onClick={() => sendAction({ action: "CONFIRM" })}
                >
                  تأكيد وإرسال للفريق
                </AquaButton>
              </AquaCard>
            ) : null}

            {session.phase === "SUBMITTED" ? (
              <AquaCard
                variant="surface"
                padding="lg"
                className="aqua-discovery-public__complete"
              >
                <CheckCircle2 aria-hidden="true" />
                <h2>وصلت إجاباتك إلى فريق Aqua Tech</h2>
                <p>
                  سيُراجع الفريق المعلومات والفجوات قبل إعداد التقرير
                  الأولي أو تحديد الخطوة التجارية التالية.
                </p>
                <AquaBadge
                  variant={
                    session.verifiedCompletionScore === 100
                      ? "success"
                      : "warning"
                  }
                >
                  اكتمال المعلومات الموثقة{" "}
                  <span dir="ltr">
                    {session.verifiedCompletionScore}%
                  </span>
                </AquaBadge>
              </AquaCard>
            ) : null}

            {session.phase !== "SUBMITTED" ? (
              <aside className="aqua-discovery-public__help">
                <button
                  type="button"
                  aria-expanded={showEscalation}
                  onClick={() =>
                    setShowEscalation((current) => !current)
                  }
                >
                  <CircleHelp aria-hidden="true" />
                  أحتاج مساعدة من موظف
                </button>
                {showEscalation ? (
                  <div>
                    <AquaTextarea
                      label="ما النقطة التي تحتاج مساعدة فيها؟"
                      rows={3}
                      value={escalationReason}
                      maxLength={2000}
                      onChange={(event) =>
                        setEscalationReason(event.target.value)
                      }
                    />
                    <AquaButton
                      size="sm"
                      loading={loadingAction === "ESCALATE"}
                      loadingLabel="جارٍ التسجيل"
                      onClick={requestHelp}
                    >
                      سجل طلب التواصل
                    </AquaButton>
                  </div>
                ) : null}
              </aside>
            ) : null}
          </div>
        ) : null}

        <footer className="aqua-discovery-public__footer">
          <span>Aqua Tech CS</span>
          <span>لا يرسل النظام سعرًا أو عرضًا دون مراجعة بشرية.</span>
        </footer>
      </div>
    </main>
  )
}
