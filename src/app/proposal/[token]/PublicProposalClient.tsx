"use client"

import {
  CheckCircle2,
  CircleX,
  FilePenLine,
  Send,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  AquaAlert,
  AquaBadge,
  AquaButton,
  AquaCard,
  AquaDetailList,
  AquaInput,
  AquaSystemDocument,
  AquaTextarea,
} from "@/components/aqua"
import {
  clientSafeProposalProjection,
} from "@/lib/proposal"

type PublicProposalState = {
  proposalNumber: string
  version: number
  status:
    | "DRAFT"
    | "IN_REVIEW"
    | "CHANGES_REQUESTED"
    | "APPROVED"
    | "SENT"
    | "CLIENT_CHANGES_REQUESTED"
    | "ACCEPTED"
    | "REJECTED"
  client: {
    name: string
    contactName: string
    serviceType: string
  }
  issuer: {
    name: string
    email: string | null
    phone: string | null
    website: string | null
  }
  currency: string
  timeZone: string
  sentAt: string | null
  validUntil: string
  respondedAt: string | null
  responderName: string | null
  responseNotes: string | null
  content: ReturnType<typeof clientSafeProposalProjection>
}

type DecisionAction = "ACCEPT" | "REQUEST_CHANGES" | "REJECT"

function decisionTitle(status: PublicProposalState["status"]) {
  if (status === "ACCEPTED") return "تم قبول العرض"
  if (status === "CLIENT_CHANGES_REQUESTED") {
    return "تم إرسال طلب التعديل"
  }
  if (status === "REJECTED") return "تم رفض العرض"
  return ""
}

export default function PublicProposalClient({
  token,
  initialState,
}: {
  token: string
  initialState: PublicProposalState
}) {
  const [state, setState] = useState(initialState)
  const [selectedAction, setSelectedAction] =
    useState<DecisionAction | null>(null)
  const [responderName, setResponderName] = useState(
    initialState.client.contactName,
  )
  const [responderEmail, setResponderEmail] = useState("")
  const [responderTitle, setResponderTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
        timeZone: state.timeZone,
        year: "numeric",
        month: "long",
        day: "2-digit",
      }),
    [state.timeZone],
  )
  const validUntilLabel = dateFormatter.format(
    new Date(state.validUntil),
  )
  const responded =
    state.status === "ACCEPTED" ||
    state.status === "CLIENT_CHANGES_REQUESTED" ||
    state.status === "REJECTED"
  const money = (value: string) =>
    `${Number(value).toLocaleString("en-JO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${state.content.commercial.currency}`

  useEffect(() => {
    void fetch(`/api/public/proposals/${token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "VIEW" }),
    })
  }, [token])

  async function submitDecision() {
    if (!selectedAction) return

    if (
      !responderName.trim() ||
      !responderEmail.trim() ||
      !authorityConfirmed
    ) {
      setError(
        "أدخل الاسم والبريد وأكد صلاحيتك للرد على العرض.",
      )
      return
    }

    if (
      selectedAction !== "ACCEPT" &&
      notes.trim().length < 10
    ) {
      setError("اكتب سببًا أو ملاحظات واضحة من 10 أحرف على الأقل.")
      return
    }

    setBusy(true)
    setError("")

    try {
      const response = await fetch(`/api/public/proposals/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: selectedAction,
          responderName,
          responderEmail,
          responderTitle: responderTitle || null,
          notes: notes || null,
          authorityConfirmed,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر تسجيل الرد")
        return
      }

      setState(data.data.state)
      setSelectedAction(null)
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="aqua-proposal-public">
      <div className="aqua-proposal-public__shell">
        <div className="aqua-proposal-public__topline">
          <div>
            <strong>Aqua Tech</strong>
            <span>عرض فني ومالي</span>
          </div>
          <div>
            <AquaBadge variant="blue" dir="ltr">
              {state.proposalNumber} · v{state.version}
            </AquaBadge>
          </div>
        </div>

        <AquaSystemDocument
          title={state.content.title}
          documentLabel="عرض فني ومالي"
          reference={`${state.proposalNumber} · v${state.version}`}
          issuedAt={state.sentAt ? dateFormatter.format(new Date(state.sentAt)) : undefined}
          footerNote={`معد لصالح ${state.client.name}`}
        >
          <AquaDetailList
            columns={2}
            items={[
              {
                label: "العميل",
                value: state.client.name,
              },
              {
                label: "الخدمة",
                value: state.client.serviceType,
              },
              {
                label: "مدة التنفيذ التقديرية",
                value: state.content.estimatedDuration,
              },
              {
                label: "صالح حتى",
                value: validUntilLabel,
                dir: "ltr",
              },
            ]}
          />

          <div className="aqua-proposal-public__sections">
            {state.content.sections.map((section) => (
              <section key={section.id}>
                <h2>{section.title}</h2>
                <div className="aqua-pre-line">{section.body}</div>
              </section>
            ))}
          </div>

          <section className="aqua-proposal-public__commercial">
            <h2>النطاق والقيمة التجارية</h2>
            <div className="aqua-proposal-public__line-items">
              {state.content.commercial.items.map((item) => (
                <div key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                  </div>
                  <span dir="ltr">{money(item.lineTotal)}</span>
                </div>
              ))}
            </div>

            <AquaDetailList
              columns={2}
              items={[
                {
                  label: "المجموع",
                  value: money(
                    state.content.commercial.totals.clientSubtotal,
                  ),
                  dir: "ltr",
                },
                {
                  label: "الخصم",
                  value: money(
                    state.content.commercial.totals.discountAmount,
                  ),
                  dir: "ltr",
                },
                {
                  label: "الضريبة",
                  value: money(
                    state.content.commercial.totals.taxAmount,
                  ),
                  dir: "ltr",
                },
                {
                  label: "الإجمالي النهائي",
                  value: money(
                    state.content.commercial.totals.grandTotal,
                  ),
                  dir: "ltr",
                },
              ]}
            />
          </section>

          <section className="aqua-proposal-public__payments">
            <h2>جدول الدفعات</h2>
            <div>
              {state.content.paymentMilestones.map((milestone) => (
                <article key={milestone.id}>
                  <div>
                    <strong>{milestone.label}</strong>
                    <span>{milestone.dueCondition}</span>
                  </div>
                  <AquaBadge variant="blue">
                    {milestone.percentage}%
                  </AquaBadge>
                </article>
              ))}
            </div>
          </section>

          {state.content.commercial.clientNotes ? (
            <section>
              <h2>ملاحظات تجارية</h2>
              <div className="aqua-pre-line">
                {state.content.commercial.clientNotes}
              </div>
            </section>
          ) : null}
        </AquaSystemDocument>

        <section
          className="aqua-proposal-public__response"
          aria-labelledby="proposal-response-title"
        >
          {responded ? (
            <AquaAlert
              variant={
                state.status === "ACCEPTED"
                  ? "success"
                  : state.status === "REJECTED"
                    ? "danger"
                    : "warning"
              }
              title={decisionTitle(state.status)}
              icon={
                state.status === "ACCEPTED" ? (
                  <CheckCircle2 />
                ) : state.status === "REJECTED" ? (
                  <CircleX />
                ) : (
                  <FilePenLine />
                )
              }
            >
              سُجل رد {state.responderName ?? "العميل"} بتاريخ{" "}
              {state.respondedAt
                ? dateFormatter.format(new Date(state.respondedAt))
                : "اليوم"}
              . سيتابع فريق Aqua Tech الخطوة التالية.
              {state.responseNotes ? (
                <div className="mt-2 aqua-pre-line">
                  {state.responseNotes}
                </div>
              ) : null}
            </AquaAlert>
          ) : (
            <>
              <div className="aqua-proposal-public__response-heading">
                <div>
                  <span>Client response</span>
                  <h2 id="proposal-response-title">ردك على العرض</h2>
                  <p>
                    اختر الإجراء المناسب. لا ينشئ القبول مشروعًا أو
                    عقدًا تلقائيًا؛ سيتواصل الفريق لإكمال الخطوة
                    التالية.
                  </p>
                </div>
                <AquaBadge variant="muted">
                  صالح حتى {validUntilLabel}
                </AquaBadge>
              </div>

              <div className="aqua-proposal-public__decision-grid">
                <AquaButton
                  variant={selectedAction === "ACCEPT" ? "primary" : "secondary"}
                  leadingIcon={<CheckCircle2 />}
                  onClick={() => setSelectedAction("ACCEPT")}
                >
                  قبول العرض
                </AquaButton>
                <AquaButton
                  variant={
                    selectedAction === "REQUEST_CHANGES"
                      ? "primary"
                      : "secondary"
                  }
                  leadingIcon={<FilePenLine />}
                  onClick={() => setSelectedAction("REQUEST_CHANGES")}
                >
                  طلب تعديل
                </AquaButton>
                <AquaButton
                  variant={selectedAction === "REJECT" ? "danger" : "ghost"}
                  leadingIcon={<CircleX />}
                  onClick={() => setSelectedAction("REJECT")}
                >
                  رفض العرض
                </AquaButton>
              </div>

              {selectedAction ? (
                <AquaCard
                  variant="soft"
                  padding="md"
                  className="aqua-proposal-public__response-form"
                >
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <AquaInput
                        label="الاسم الكامل"
                        value={responderName}
                        onChange={(event) =>
                          setResponderName(event.target.value)
                        }
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <AquaInput
                        label="البريد الإلكتروني"
                        type="email"
                        dir="ltr"
                        value={responderEmail}
                        onChange={(event) =>
                          setResponderEmail(event.target.value)
                        }
                      />
                    </div>
                    <div className="col-12">
                      <AquaInput
                        label="الصفة الوظيفية (اختياري)"
                        value={responderTitle}
                        onChange={(event) =>
                          setResponderTitle(event.target.value)
                        }
                      />
                    </div>
                    <div className="col-12">
                      <AquaTextarea
                        label={
                          selectedAction === "ACCEPT"
                            ? "ملاحظات إضافية (اختياري)"
                            : selectedAction === "REQUEST_CHANGES"
                              ? "التعديلات المطلوبة"
                              : "سبب رفض العرض"
                        }
                        rows={5}
                        value={notes}
                        onChange={(event) =>
                          setNotes(event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <label className="aqua-proposal-public__authority">
                    <input
                      type="checkbox"
                      checked={authorityConfirmed}
                      onChange={(event) =>
                        setAuthorityConfirmed(event.target.checked)
                      }
                    />
                    <span>
                      أؤكد أنني مخول بتسجيل هذا الرد نيابة عن الجهة
                      المذكورة في العرض.
                    </span>
                  </label>

                  {error ? (
                    <AquaAlert variant="danger" title="راجع البيانات">
                      {error}
                    </AquaAlert>
                  ) : null}

                  <div className="d-flex flex-wrap gap-2">
                    <AquaButton
                      leadingIcon={<Send />}
                      loading={busy}
                      loadingLabel="جارٍ تسجيل الرد"
                      onClick={submitDecision}
                    >
                      تأكيد وإرسال الرد
                    </AquaButton>
                    <AquaButton
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setSelectedAction(null)
                        setError("")
                      }}
                    >
                      إلغاء
                    </AquaButton>
                  </div>
                </AquaCard>
              ) : null}
            </>
          )}
        </section>

        <footer className="aqua-proposal-public__footer">
          <span>الرابط خاص بهذه النسخة من العرض.</span>
          <span dir="ltr">Aqua.Tech · {state.proposalNumber}</span>
        </footer>
      </div>
    </main>
  )
}
