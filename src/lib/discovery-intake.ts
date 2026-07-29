export type DiscoveryServiceTrackValue =
  | "WEBSITE_COMMERCE"
  | "SOFTWARE_SAAS"
  | "AUTOMATION_AI"
  | "MARKETING_GROWTH"
  | "GENERAL"

export type IntakeAnswerSourceValue =
  | "CUSTOMER_FACT"
  | "UPLOADED_EVIDENCE"
  | "AI_INFERENCE"
  | "INTERNAL_NOTE"
  | "APPROVED_DECISION"

export type DiscoveryAnswerValue = {
  questionKey: string
  value: string
  source: IntakeAnswerSourceValue
  isUnknown: boolean
}

export type DiscoveryQuestion = {
  key: string
  sectionKey: string
  sectionLabel: string
  label: string
  hint: string
  required: boolean
  severity: "MEDIUM" | "HIGH" | "CRITICAL"
}

export const DISCOVERY_TEMPLATE_VERSION = "DISCOVERY_V1"

export const DISCOVERY_SERVICE_TRACKS: readonly DiscoveryServiceTrackValue[] = [
  "WEBSITE_COMMERCE",
  "SOFTWARE_SAAS",
  "AUTOMATION_AI",
  "MARKETING_GROWTH",
  "GENERAL",
]

const commonQuestions: readonly DiscoveryQuestion[] = [
  {
    key: "business_context",
    sectionKey: "context",
    sectionLabel: "السياق التجاري",
    label: "ما طبيعة النشاط والسوق الذي يعمل فيه العميل؟",
    hint: "القطاع، السوق المستهدف، الموقع الجغرافي، وحجم التشغيل عند توفره.",
    required: true,
    severity: "HIGH",
  },
  {
    key: "current_problem",
    sectionKey: "context",
    sectionLabel: "السياق التجاري",
    label: "ما المشكلة الحالية التي يريد العميل حلها؟",
    hint: "سجّل وصف العميل نفسه، والأثر التشغيلي أو التجاري للمشكلة.",
    required: true,
    severity: "CRITICAL",
  },
  {
    key: "current_solution",
    sectionKey: "context",
    sectionLabel: "السياق التجاري",
    label: "كيف يعالج العميل المشكلة حاليًا؟",
    hint: "الأدوات الحالية، الخطوات اليدوية، وما الذي لا يعمل بصورة جيدة.",
    required: true,
    severity: "HIGH",
  },
  {
    key: "desired_outcome",
    sectionKey: "goals",
    sectionLabel: "الأهداف والنجاح",
    label: "ما النتيجة التي يتوقعها العميل من المشروع؟",
    hint: "النتيجة التجارية أو التشغيلية، لا اسم الحل التقني فقط.",
    required: true,
    severity: "CRITICAL",
  },
  {
    key: "target_audience",
    sectionKey: "goals",
    sectionLabel: "الأهداف والنجاح",
    label: "من المستخدمون أو الجمهور المستهدف؟",
    hint: "الفئات الرئيسية، احتياجاتها، واللغات أو المناطق المهمة.",
    required: true,
    severity: "HIGH",
  },
  {
    key: "success_measures",
    sectionKey: "goals",
    sectionLabel: "الأهداف والنجاح",
    label: "كيف سيعرف العميل أن المشروع نجح؟",
    hint: "نتائج قابلة للملاحظة أو القياس، حتى لو كانت أولية.",
    required: true,
    severity: "HIGH",
  },
  {
    key: "decision_process",
    sectionKey: "delivery",
    sectionLabel: "القرار والقيود",
    label: "من يشارك في القرار والاعتماد؟",
    hint: "صاحب القرار، المراجعون، وأي اعتماد داخلي أو خارجي.",
    required: true,
    severity: "HIGH",
  },
  {
    key: "budget_expectation",
    sectionKey: "delivery",
    sectionLabel: "القرار والقيود",
    label: "ما الميزانية أو النطاق المتوقع؟",
    hint: "إذا لم تُحدد، سجّل ذلك كفجوة بدل اختراع رقم.",
    required: true,
    severity: "HIGH",
  },
  {
    key: "launch_timeline",
    sectionKey: "delivery",
    sectionLabel: "القرار والقيود",
    label: "ما موعد البدء أو الإطلاق المتوقع؟",
    hint: "اذكر أي موعد ملزم وسبب أهميته.",
    required: true,
    severity: "HIGH",
  },
  {
    key: "constraints_and_risks",
    sectionKey: "delivery",
    sectionLabel: "القرار والقيود",
    label: "ما القيود أو المخاطر المعروفة؟",
    hint: "قانونية، أمنية، تقنية، بيانات، وقت، اعتماديات، أو موارد.",
    required: true,
    severity: "CRITICAL",
  },
]

const trackQuestions: Record<
  DiscoveryServiceTrackValue,
  readonly DiscoveryQuestion[]
> = {
  WEBSITE_COMMERCE: [
    {
      key: "web_scope",
      sectionKey: "service",
      sectionLabel: "تفاصيل الموقع أو المتجر",
      label: "ما الصفحات والوظائف أو المنتجات المطلوبة؟",
      hint: "اذكر الوظائف الأساسية، إدارة المحتوى، والحسابات عند الحاجة.",
      required: true,
      severity: "CRITICAL",
    },
    {
      key: "web_content_brand",
      sectionKey: "service",
      sectionLabel: "تفاصيل الموقع أو المتجر",
      label: "ما المحتوى والهوية واللغات المتوفرة؟",
      hint: "حدّد ما سيقدمه العميل وما يحتاج إلى إنتاج أو ترجمة.",
      required: true,
      severity: "HIGH",
    },
    {
      key: "web_commerce_operations",
      sectionKey: "service",
      sectionLabel: "تفاصيل الموقع أو المتجر",
      label: "ما متطلبات الدفع والشحن والطلبات إن انطبقت؟",
      hint: "اكتب «لا ينطبق» بوضوح عندما لا يكون المشروع متجرًا.",
      required: true,
      severity: "HIGH",
    },
    {
      key: "web_integrations",
      sectionKey: "service",
      sectionLabel: "تفاصيل الموقع أو المتجر",
      label: "ما متطلبات النطاق والاستضافة وSEO والتكاملات؟",
      hint: "التحليلات، النماذج، CRM، بوابات الدفع، أو خدمات خارجية.",
      required: true,
      severity: "HIGH",
    },
  ],
  SOFTWARE_SAAS: [
    {
      key: "software_users_roles",
      sectionKey: "service",
      sectionLabel: "تفاصيل النظام",
      label: "من أنواع المستخدمين وما صلاحياتهم؟",
      hint: "فرّق بين المالكين والمديرين والموظفين والعملاء.",
      required: true,
      severity: "CRITICAL",
    },
    {
      key: "software_workflows",
      sectionKey: "service",
      sectionLabel: "تفاصيل النظام",
      label: "ما العمليات الرئيسية التي يجب أن يديرها النظام؟",
      hint: "ابدأ بالحدث ثم الخطوات والنتيجة والاستثناءات.",
      required: true,
      severity: "CRITICAL",
    },
    {
      key: "software_data_reports",
      sectionKey: "service",
      sectionLabel: "تفاصيل النظام",
      label: "ما البيانات والتقارير والاستيراد المطلوب؟",
      hint: "مصادر البيانات، أحجامها، والتقارير أو المؤشرات المهمة.",
      required: true,
      severity: "HIGH",
    },
    {
      key: "software_nonfunctional",
      sectionKey: "service",
      sectionLabel: "تفاصيل النظام",
      label: "ما متطلبات الأمان والتدقيق والتوسع والتوفر؟",
      hint: "اذكر حساسية البيانات، سجل المراجعة، والتكاملات.",
      required: true,
      severity: "CRITICAL",
    },
  ],
  AUTOMATION_AI: [
    {
      key: "automation_current_process",
      sectionKey: "service",
      sectionLabel: "تفاصيل الأتمتة والذكاء الاصطناعي",
      label: "ما العملية اليدوية الحالية من البداية إلى النهاية؟",
      hint: "المدخلات، الخطوات، المسؤولون، المخرجات، وحجم التكرار.",
      required: true,
      severity: "CRITICAL",
    },
    {
      key: "automation_systems_data",
      sectionKey: "service",
      sectionLabel: "تفاصيل الأتمتة والذكاء الاصطناعي",
      label: "ما الأنظمة ومصادر البيانات التي ستتصل بها العملية؟",
      hint: "واجهات API، البريد، الجداول، قواعد البيانات، والملفات.",
      required: true,
      severity: "CRITICAL",
    },
    {
      key: "automation_exceptions_approvals",
      sectionKey: "service",
      sectionLabel: "تفاصيل الأتمتة والذكاء الاصطناعي",
      label: "ما الاستثناءات والموافقات البشرية المطلوبة؟",
      hint: "حدّد متى تتوقف الأتمتة ومَن يراجع القرار.",
      required: true,
      severity: "CRITICAL",
    },
    {
      key: "automation_quality_limits",
      sectionKey: "service",
      sectionLabel: "تفاصيل الأتمتة والذكاء الاصطناعي",
      label: "ما مستوى الدقة والسرعة والتكلفة المقبول؟",
      hint: "معايير النجاح، حدود الخطأ، الخصوصية، والتكلفة التشغيلية.",
      required: true,
      severity: "HIGH",
    },
  ],
  MARKETING_GROWTH: [
    {
      key: "marketing_offer_audience",
      sectionKey: "service",
      sectionLabel: "تفاصيل التسويق والنمو",
      label: "ما العرض والجمهور والقيمة المقترحة؟",
      hint: "المنتج أو الخدمة، العميل المثالي، وسبب اختياره للعرض.",
      required: true,
      severity: "CRITICAL",
    },
    {
      key: "marketing_channels_assets",
      sectionKey: "service",
      sectionLabel: "تفاصيل التسويق والنمو",
      label: "ما القنوات والأصول والحملات الحالية؟",
      hint: "الموقع، الحسابات، المحتوى، قوائم العملاء، والحملات السابقة.",
      required: true,
      severity: "HIGH",
    },
    {
      key: "marketing_conversion_tracking",
      sectionKey: "service",
      sectionLabel: "تفاصيل التسويق والنمو",
      label: "ما التحويلات وآلية القياس الحالية؟",
      hint: "الأحداث، التحليلات، CRM، والتقارير المطلوبة.",
      required: true,
      severity: "CRITICAL",
    },
    {
      key: "marketing_budget_constraints",
      sectionKey: "service",
      sectionLabel: "تفاصيل التسويق والنمو",
      label: "ما ميزانية القنوات والقيود والمنافسون؟",
      hint: "افصل ميزانية الإعلانات عن تكلفة الخدمة عند توفرهما.",
      required: true,
      severity: "HIGH",
    },
  ],
  GENERAL: [
    {
      key: "general_deliverables",
      sectionKey: "service",
      sectionLabel: "تفاصيل الخدمة",
      label: "ما المخرجات التي يتوقع العميل استلامها؟",
      hint: "اكتب المخرجات بصيغة يمكن لاحقًا تحويلها إلى نطاق وتسليمات.",
      required: true,
      severity: "CRITICAL",
    },
    {
      key: "general_workflow",
      sectionKey: "service",
      sectionLabel: "تفاصيل الخدمة",
      label: "كيف ستُستخدم المخرجات داخل عمل العميل؟",
      hint: "السياق التشغيلي، المستخدمون، والخطوة التالية بعد التسليم.",
      required: true,
      severity: "HIGH",
    },
    {
      key: "general_dependencies",
      sectionKey: "service",
      sectionLabel: "تفاصيل الخدمة",
      label: "ما المواد والاعتماديات التي يجب أن يوفرها العميل؟",
      hint: "ملفات، وصول للأنظمة، محتوى، موافقات، أو أطراف خارجية.",
      required: true,
      severity: "HIGH",
    },
    {
      key: "general_acceptance",
      sectionKey: "service",
      sectionLabel: "تفاصيل الخدمة",
      label: "ما شروط قبول المخرجات؟",
      hint: "المراجعة، الاختبار، الموافقة، وحدود التعديلات.",
      required: true,
      severity: "CRITICAL",
    },
  ],
}

export function discoveryTrackLabel(track: DiscoveryServiceTrackValue) {
  const labels: Record<DiscoveryServiceTrackValue, string> = {
    WEBSITE_COMMERCE: "مواقع ومتاجر",
    SOFTWARE_SAAS: "أنظمة وSaaS",
    AUTOMATION_AI: "أتمتة وذكاء اصطناعي",
    MARKETING_GROWTH: "تسويق ونمو",
    GENERAL: "خدمة عامة",
  }

  return labels[track]
}

export function inferDiscoveryServiceTrack(
  serviceType?: string | null,
): DiscoveryServiceTrackValue {
  const normalized = serviceType?.trim().toLocaleLowerCase("ar-JO") ?? ""

  if (
    /(website|web |e-?commerce|store|shop|landing|موقع|متجر|صفحة هبوط)/u.test(
      normalized,
    )
  ) {
    return "WEBSITE_COMMERCE"
  }

  if (
    /(automation|artificial intelligence|ai\b|chatbot|n8n|أتمت|اتمت|ذكاء)/u.test(
      normalized,
    )
  ) {
    return "AUTOMATION_AI"
  }

  if (
    /(marketing|growth|campaign|seo|ads|content|تسويق|نمو|حمل|إعلان|اعلان|محتوى)/u.test(
      normalized,
    )
  ) {
    return "MARKETING_GROWTH"
  }

  if (
    /(software|saas|system|platform|application|app\b|نظام|منصة|تطبيق|برمج)/u.test(
      normalized,
    )
  ) {
    return "SOFTWARE_SAAS"
  }

  return "GENERAL"
}

export function discoveryQuestionsForTrack(
  track: DiscoveryServiceTrackValue,
) {
  return [...commonQuestions, ...trackQuestions[track]]
}

export function discoverySectionsForTrack(
  track: DiscoveryServiceTrackValue,
) {
  const questions = discoveryQuestionsForTrack(track)

  return Array.from(
    new Map(
      questions.map((question) => [
        question.sectionKey,
        {
          key: question.sectionKey,
          label: question.sectionLabel,
        },
      ]),
    ).values(),
  )
}

export function discoveryQuestionByKey(
  track: DiscoveryServiceTrackValue,
  questionKey: string,
) {
  return discoveryQuestionsForTrack(track).find(
    (question) => question.key === questionKey,
  )
}

export function isDiscoveryAnswerSufficient(
  answer?: Pick<
    DiscoveryAnswerValue,
    "value" | "source" | "isUnknown"
  > | null,
) {
  if (!answer || answer.isUnknown || answer.value.trim().length < 2) {
    return false
  }

  return (
    answer.source === "CUSTOMER_FACT" ||
    answer.source === "UPLOADED_EVIDENCE" ||
    answer.source === "APPROVED_DECISION"
  )
}

export function discoveryCompletionScore({
  track,
  answers,
}: {
  track: DiscoveryServiceTrackValue
  answers: readonly DiscoveryAnswerValue[]
}) {
  const requiredQuestions = discoveryQuestionsForTrack(track).filter(
    (question) => question.required,
  )
  const answerMap = new Map(
    answers.map((answer) => [answer.questionKey, answer]),
  )
  const completed = requiredQuestions.filter((question) =>
    isDiscoveryAnswerSufficient(answerMap.get(question.key)),
  ).length

  if (requiredQuestions.length === 0) return 100

  return Math.round((completed / requiredQuestions.length) * 100)
}

export function missingDiscoveryQuestions({
  track,
  answers,
}: {
  track: DiscoveryServiceTrackValue
  answers: readonly DiscoveryAnswerValue[]
}) {
  const answerMap = new Map(
    answers.map((answer) => [answer.questionKey, answer]),
  )

  return discoveryQuestionsForTrack(track).filter(
    (question) =>
      question.required &&
      !isDiscoveryAnswerSufficient(answerMap.get(question.key)),
  )
}

export function canSubmitDiscoveryForReview({
  track,
  answers,
  waivedQuestionKeys,
}: {
  track: DiscoveryServiceTrackValue
  answers: readonly DiscoveryAnswerValue[]
  waivedQuestionKeys: readonly string[]
}) {
  const waived = new Set(waivedQuestionKeys)

  return missingDiscoveryQuestions({ track, answers }).every((question) =>
    waived.has(question.key),
  )
}

export function shouldReopenDiscoveryGap({
  status,
  resolution,
}: {
  status: "OPEN" | "RESOLVED" | "WAIVED"
  resolution?: string | null
}) {
  return (
    status === "RESOLVED" ||
    (status === "WAIVED" &&
      resolution ===
        "تم استبعاد السؤال بعد تغيير مسار الخدمة.")
  )
}

export function isDiscoveryLeadEligible({
  status,
  hasOpportunity,
}: {
  status: string
  hasOpportunity: boolean
}) {
  if (
    ["NEW", "CONTACTED", "DISCOVERY", "NEEDS_INFO", "QUALIFIED"].includes(
      status,
    )
  ) {
    return true
  }

  return status === "CONVERTED" && hasOpportunity
}
