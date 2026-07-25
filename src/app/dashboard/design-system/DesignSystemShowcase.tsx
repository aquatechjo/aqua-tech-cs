"use client"

import { useEffect, useMemo, useState, type KeyboardEvent } from "react"
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  Component,
  FileText,
  LayoutGrid,
  PackageCheck,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react"

import {
  AquaAlert,
  AquaBadge,
  AquaButton,
  AquaCard,
  AquaDataPanel,
  AquaDetailList,
  AquaInput,
  AquaLinkButton,
  AquaMark,
  AquaPageState,
  AquaSelect,
  AquaSpinner,
  AquaSystemDocument,
  AquaTable,
  AquaTabs,
  AquaTextarea,
} from "@/components/aqua"
import {
  aquaBadgeVariants,
  aquaButtonVariants,
  aquaCardVariants,
  aquaDesignSystemComponentGroups,
  aquaDesignSystemCssLayers,
  aquaDesignSystemPackageName,
  aquaDesignSystemShowcase,
  aquaDesignSystemVersion,
  aquaStarterDensities,
} from "@/design-system"

const densityTabs = aquaStarterDensities.map((density) => ({
  id: density,
  label:
    density === "compact"
      ? "مضغوط"
      : density === "spacious"
        ? "واسع"
        : "مريح",
}))

const overviewCards = [
  {
    title: "حزمة موحّدة",
    term: "Package",
    description:
      "المكونات والعقود وطبقات CSS أصبحت مصدرًا واحدًا يمكن نقله بين منتجات Aqua.Tech.",
    icon: <PackageCheck />,
  },
  {
    title: "مزامنة تلقائية",
    term: "Package sync",
    description:
      "فحص يمنع اختلاف النسخة القابلة لإعادة الاستخدام عن المصدر الأساسي داخل AquaFlow.",
    icon: <RefreshCw />,
  },
  {
    title: "بداية جاهزة",
    term: "Product starter",
    description:
      "مولّد يجهز مشروع Next.js جديدًا مع Bootstrap والهوية ومساحة Product Theme.",
    icon: <Boxes />,
  },
  {
    title: "حوكمة بصرية",
    term: "Visual contract",
    description:
      "بصمة ثابتة تكتشف تغير العقود وCSS وبنية المرجع قبل اعتماد أي إصدار.",
    icon: <ShieldCheck />,
  },
] as const

const releaseGates = [
  ["Package sync", "ناجح", "الحزمة مطابقة للمصدر"],
  ["Visual contract", "ناجح", "البصمة مطابقة للـbaseline"],
  ["Quality gate", "ناجح", "Lint + Typecheck + Tests + Build"],
] as const

type SectionId =
  | "overview"
  | "foundation"
  | "actions"
  | "forms"
  | "workflows"
  | "public"
  | "governance"

type ShowcaseNavigationItem = {
  id: SectionId
  title: string
  description: string
}

export default function DesignSystemShowcase() {
  const [density, setDensity] = useState<(typeof aquaStarterDensities)[number]>(
    "comfortable"
  )
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>("overview")

  const navigation = useMemo<ShowcaseNavigationItem[]>(
    () => [
      {
        id: "overview",
        title: "نظرة عامة",
        description: "ما الذي أنجزناه ولماذا نحتاجه؟",
      },
      ...aquaDesignSystemShowcase.sections.map((section) => ({
        id: section.id as SectionId,
        title: section.title,
        description: section.description,
      })),
    ],
    []
  )

  useEffect(() => {
    function syncSectionFromHash() {
      const section = window.location.hash.slice(1) as SectionId
      if (navigation.some((item) => item.id === section)) {
        setActiveSection(section)
      }
    }

    syncSectionFromHash()
    window.addEventListener("hashchange", syncSectionFromHash)
    return () => window.removeEventListener("hashchange", syncSectionFromHash)
  }, [navigation])

  function selectSection(section: SectionId) {
    setActiveSection(section)
    window.history.replaceState(null, "", `#${section}`)
    window.requestAnimationFrame(() => {
      const panel = document.getElementById("aqua-showcase-panel")
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

      panel?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      })
      panel?.focus({ preventScroll: true })
    })
  }

  function handleNavigationKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = navigation.findIndex(
      (item) => item.id === activeSection
    )
    const keys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"]

    if (!keys.includes(event.key)) return

    event.preventDefault()

    let nextIndex = currentIndex
    if (event.key === "Home") nextIndex = 0
    if (event.key === "End") nextIndex = navigation.length - 1
    if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      nextIndex = (currentIndex + 1) % navigation.length
    }
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      nextIndex = (currentIndex - 1 + navigation.length) % navigation.length
    }

    const nextSection = navigation[nextIndex]
    selectSection(nextSection.id)
    document
      .querySelector<HTMLButtonElement>(`[data-showcase-tab="${nextSection.id}"]`)
      ?.focus()
  }

  function simulateLoading() {
    setLoading(true)
    window.setTimeout(() => setLoading(false), 900)
  }

  function printSystemDocument() {
    document.body.classList.add("aqua-printing-system-document")

    const cleanup = () => {
      document.body.classList.remove("aqua-printing-system-document")
      window.removeEventListener("afterprint", cleanup)
    }

    window.addEventListener("afterprint", cleanup)
    window.print()
    window.setTimeout(cleanup, 1500)
  }

  return (
    <div
      className="aqua-showcase"
      data-aqua-showcase-version={aquaDesignSystemVersion}
      data-aqua-density={density}
    >
      <header className="aqua-showcase__hero">
        <div className="aqua-showcase__hero-copy">
          <div className="aqua-showcase__hero-badges">
            <AquaBadge variant="aqua">DS-06.1</AquaBadge>
            <AquaBadge variant="success" dot>
              Baseline معتمد
            </AquaBadge>
          </div>
          <span className="aqua-showcase__eyebrow" dir="ltr">
            AQUA.TECH DESIGN SYSTEM
          </span>
          <h1>مرجع واضح لبناء منتجات متناسقة</h1>
          <p>
            هذه المساحة ليست صفحة تشغيل للمستخدم؛ هي كتالوج داخلي يشرح المكونات،
            الحزمة، الـStarter، وبوابات الجودة التي تمنع اختلاف مشاريع Aqua.Tech.
          </p>
          <div className="aqua-showcase__hero-actions">
            <AquaLinkButton
              href="/dashboard"
              variant="secondary"
              size="sm"
              leadingIcon={<ArrowRight />}
            >
              العودة إلى لوحة التحكم
            </AquaLinkButton>
            <AquaButton
              variant="ghost"
              size="sm"
              leadingIcon={<Printer />}
              onClick={() => selectSection("public")}
            >
              معاينة المستند
            </AquaButton>
          </div>
        </div>

        <div className="aqua-showcase__hero-status" aria-label="ملخص الحزمة">
          <div>
            <span>الحزمة</span>
            <strong dir="ltr">{aquaDesignSystemPackageName}</strong>
          </div>
          <div>
            <span>الإصدار</span>
            <strong dir="ltr">v{aquaDesignSystemVersion}</strong>
          </div>
          <div>
            <span>المكونات</span>
            <strong>
              {Object.values(aquaDesignSystemComponentGroups).flat().length}
            </strong>
          </div>
          <div>
            <span>طبقات CSS</span>
            <strong>{aquaDesignSystemCssLayers.length}</strong>
          </div>
        </div>
      </header>

      <div className="aqua-showcase__workspace">
        <aside className="aqua-showcase__rail" aria-label="أقسام نظام التصميم">
          <div className="aqua-showcase__rail-card">
            <div className="aqua-showcase__rail-heading">
              <LayoutGrid aria-hidden="true" />
              <div>
                <strong>أقسام المرجع</strong>
                <span>اختر قسمًا واحدًا للتركيز</span>
              </div>
            </div>

            <div
              className="aqua-showcase__navigation"
              role="tablist"
              aria-orientation="vertical"
            >
              {navigation.map((item) => {
                const active = item.id === activeSection
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    id={`aqua-showcase-tab-${item.id}`}
                    aria-controls="aqua-showcase-panel"
                    tabIndex={active ? 0 : -1}
                    className={`aqua-showcase__nav-item ${
                      active ? "aqua-showcase__nav-item--active" : ""
                    }`}
                    data-showcase-tab={item.id}
                    onClick={() => selectSection(item.id)}
                    onKeyDown={handleNavigationKeyDown}
                  >
                    <span className="aqua-showcase__nav-icon" aria-hidden="true">
                      <SectionIcon id={item.id} />
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </span>
                    <ChevronLeft aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="aqua-showcase__rail-card aqua-showcase__density-card">
            <span className="aqua-showcase__eyebrow">كثافة المعاينة</span>
            <AquaTabs
              items={densityTabs}
              activeId={density}
              variant="pill"
              label="كثافة المعاينة"
              onChange={(value) =>
                setDensity(value as (typeof aquaStarterDensities)[number])
              }
            />
            <p>تغيّر المسافات فقط؛ لا تنشئ Variant جديدًا للمكونات.</p>
          </div>
        </aside>

        <main
          id="aqua-showcase-panel"
          className="aqua-showcase__panel"
          role="tabpanel"
          tabIndex={-1}
          aria-labelledby={`aqua-showcase-tab-${activeSection}`}
        >
          {activeSection === "overview" ? <OverviewSection /> : null}
          {activeSection === "foundation" ? <FoundationSection /> : null}
          {activeSection === "actions" ? (
            <ActionsSection
              loading={loading}
              onSimulateLoading={simulateLoading}
            />
          ) : null}
          {activeSection === "forms" ? <FormsSection /> : null}
          {activeSection === "workflows" ? <WorkflowsSection /> : null}
          {activeSection === "public" ? (
            <PublicSection onPrint={printSystemDocument} />
          ) : null}
          {activeSection === "governance" ? <GovernanceSection /> : null}
        </main>
      </div>
    </div>
  )
}

function OverviewSection() {
  return (
    <ShowcaseSection
      icon={<Sparkles />}
      kicker="OVERVIEW"
      title="ما الذي أنجزناه في DS-06؟"
      description="حوّلنا نظام التصميم من ملفات داخل مشروع واحد إلى بنية قابلة لإعادة الاستخدام والاختبار والترقية المقصودة."
    >
      <div className="aqua-showcase__overview-grid">
        {overviewCards.map((item) => (
          <AquaCard key={item.term} variant="outlined" className="aqua-showcase__concept-card">
            <span className="aqua-showcase__concept-icon" aria-hidden="true">
              {item.icon}
            </span>
            <div>
              <span className="aqua-showcase__technical-term" dir="ltr">
                {item.term}
              </span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </AquaCard>
        ))}
      </div>

      <AquaCard className="aqua-showcase__flow-card">
        <div className="aqua-showcase__flow-copy">
          <span className="aqua-showcase__eyebrow">طريقة العمل</span>
          <h3>المصدر يتغيّر مرة واحدة، ثم تمر التغييرات عبر بوابات واضحة</h3>
          <p>
            نعدّل المكوّن في AquaFlow، نزامن الحزمة، نفحص العقود والبصمة البصرية،
            ثم نشغّل بوابة الجودة قبل الاعتماد.
          </p>
        </div>
        <ol className="aqua-showcase__flow" aria-label="مراحل اعتماد التغيير">
          {["Source", "Package sync", "Visual contract", "Quality gate"].map(
            (step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                <strong dir="ltr">{step}</strong>
              </li>
            )
          )}
        </ol>
      </AquaCard>

      <AquaAlert variant="info" title="ماذا لا يعني ذلك؟">
        هذه الصفحة ليست واجهة نهائية للعملاء، ولا تعني أن جميع صفحات AquaFlow تحولت
        تلقائيًا. هي المرجع الذي سنستخدمه عند مرحلة التبنّي التدريجي.
      </AquaAlert>
    </ShowcaseSection>
  )
}

function FoundationSection() {
  return (
    <ShowcaseSection
      icon={<Sparkles />}
      kicker="FOUNDATION"
      title="الأساس والهوية"
      description="DNA ثابت لعلامة Aqua.Tech مع مساحة Product Personality مضبوطة لكل منتج."
    >
      <div className="aqua-showcase__foundation-layout">
        <AquaCard glow className="aqua-showcase__brand-card">
          <AquaMark size="lg" />
          <div>
            <span className="aqua-showcase__technical-term">Product theme</span>
            <h3>العلامة ثابتة، وشخصية المنتج متغيرة ضمن حدود</h3>
            <p>
              الاسم واللون المساعد والكثافة تتغير، بينما المسافات والحواف والحالات
              وإتاحة الاستخدام تبقى موحّدة.
            </p>
          </div>
          <div className="aqua-showcase__badge-row">
            {aquaBadgeVariants.map((variant) => (
              <AquaBadge key={variant} variant={variant} size="sm">
                {variant}
              </AquaBadge>
            ))}
          </div>
        </AquaCard>

        <div className="aqua-showcase__surface-grid">
          {aquaCardVariants.map((variant) => (
            <AquaCard key={variant} variant={variant}>
              <AquaBadge variant="blue" size="sm">
                {variant}
              </AquaBadge>
              <h3>{surfaceLabel(variant)}</h3>
              <p>
                سطح معتمد للتجميع البصري؛ لا يحتاج المطور إلى وصفة CSS جديدة داخل
                كل صفحة.
              </p>
            </AquaCard>
          ))}
        </div>
      </div>
    </ShowcaseSection>
  )
}

function ActionsSection({
  loading,
  onSimulateLoading,
}: {
  loading: boolean
  onSimulateLoading: () => void
}) {
  return (
    <ShowcaseSection
      icon={<Component />}
      kicker="ACTIONS & FEEDBACK"
      title="الإجراءات والحالات"
      description="Variants محدودة وحالات واضحة بدل أزرار مخصصة ومتناقضة بين الصفحات."
    >
      <div className="aqua-showcase__demo-grid">
        <AquaCard>
          <DemoHeading
            title="أنواع الأزرار"
            term="Variants"
            description="اختر النوع بحسب أهمية الإجراء، لا بحسب اللون المفضل."
          />
          <div className="aqua-showcase__button-row">
            {aquaButtonVariants.map((variant) => (
              <AquaButton key={variant} variant={variant}>
                {buttonLabel(variant)}
              </AquaButton>
            ))}
          </div>
        </AquaCard>

        <AquaCard>
          <DemoHeading
            title="حالات التنفيذ"
            term="States"
            description="التحميل والتعطيل والجاهزية جزء من العقد نفسه."
          />
          <div className="aqua-showcase__state-stack">
            <span className="aqua-showcase__status-line">
              <AquaSpinner size="sm" />
              <span>الحالة جاهزة</span>
            </span>
            <AquaButton
              loading={loading}
              loadingLabel="جارٍ فحص الحالة"
              leadingIcon={<ShieldCheck />}
              onClick={onSimulateLoading}
            >
              تشغيل مثال التحميل
            </AquaButton>
            <AquaButton disabled variant="secondary">
              إجراء معطّل
            </AquaButton>
          </div>
        </AquaCard>
      </div>

      <div className="aqua-showcase__alerts">
        <AquaAlert variant="success" title="نجاح واضح">
          استخدمه بعد اكتمال الإجراء عندما يحتاج المستخدم إلى تأكيد مباشر.
        </AquaAlert>
        <AquaAlert variant="warning" title="تنبيه يحتاج قرارًا">
          التحذير لا يساوي الخطأ؛ يوضح أثر الاستمرار قبل التنفيذ.
        </AquaAlert>
      </div>
    </ShowcaseSection>
  )
}

function FormsSection() {
  return (
    <ShowcaseSection
      icon={<Component />}
      kicker="FORMS"
      title="النماذج والحقول"
      description="تسمية وإرشاد وخطأ وتعطيل بحجم منطقي واحد ومتوافق مع RTL وLTR."
    >
      <AquaCard>
        <DemoHeading
          title="حالات الحقول المعتمدة"
          term="Field states"
          description="الأمثلة التالية مقصودة؛ كل حالة توضح للمستخدم ماذا يفعل."
        />
        <div className="aqua-showcase__form-grid">
          <AquaInput
            label="اسم المنتج"
            defaultValue="AquaFlow"
            hint="اسم واضح وقصير يظهر داخل النظام."
          />
          <AquaSelect label="شخصية المنتج" defaultValue="operational">
            <option value="operational">تشغيلية — Operational</option>
            <option value="professional">مهنية — Professional</option>
            <option value="intelligent">ذكية — Intelligent</option>
            <option value="expressive">تعبيرية — Expressive</option>
          </AquaSelect>
          <AquaInput
            label="معرّف الحزمة"
            defaultValue="@aqua-tech/design-system"
            error="هذا مثال لحالة خطأ مرئية ومباشرة."
            dir="ltr"
          />
          <AquaInput
            label="قيمة غير قابلة للتعديل"
            defaultValue="Managed by governance"
            hint="القيم المحكومة تظهر بوضوح دون إخفاء سبب تعطيلها."
            disabled
            dir="ltr"
          />
          <AquaTextarea
            label="ملاحظات الإصدار"
            defaultValue="وثّق سبب التغيير ونطاقه وأثره قبل تحديث رقم الإصدار."
            wrapperClassName="aqua-showcase__form-wide"
          />
        </div>
      </AquaCard>
    </ShowcaseSection>
  )
}

function WorkflowsSection() {
  const statusItems = [
    { label: "الحزمة", value: aquaDesignSystemPackageName, dir: "ltr" as const },
    { label: "الإصدار", value: aquaDesignSystemVersion, dir: "ltr" as const },
    { label: "طبقات CSS", value: aquaDesignSystemCssLayers.length },
    {
      label: "المكونات",
      value: Object.values(aquaDesignSystemComponentGroups).flat().length,
    },
  ]

  return (
    <ShowcaseSection
      icon={<Workflow />}
      kicker="DATA & WORKFLOWS"
      title="البيانات والـWorkflows"
      description="الجداول والتفاصيل والحالات الفارغة تستخدم بنية واحدة قابلة للتنبؤ."
    >
      <AquaDataPanel
        title="حالة الإصدار المعتمد"
        description={`هذه نتيجة baseline الإصدار ${aquaDesignSystemVersion} وليست قراءة لحظية من جهاز المستخدم.`}
        meta={
          <AquaBadge variant="success" dot>
            جميع البوابات ناجحة
          </AquaBadge>
        }
        footer="بعد أي تعديل جديد يجب إعادة تشغيل npm run check قبل اعتماد الحالة."
      >
        <AquaTable caption="نتيجة بوابات إصدار نظام التصميم" mobileStrategy="stack">
          <thead>
            <tr>
              <th>البوابة</th>
              <th>الحالة</th>
              <th>النتيجة</th>
            </tr>
          </thead>
          <tbody>
            {releaseGates.map(([gate, state, result]) => (
              <tr key={gate}>
                <td data-label="البوابة" dir="ltr">
                  {gate}
                </td>
                <td data-label="الحالة">
                  <AquaBadge variant="success">{state}</AquaBadge>
                </td>
                <td data-label="النتيجة">{result}</td>
              </tr>
            ))}
          </tbody>
        </AquaTable>
      </AquaDataPanel>

      <div className="aqua-showcase__states-grid">
        <AquaPageState
          variant="empty"
          compact
          title="لا توجد انحرافات"
          description="لا توجد ألوان أو Variants خارج العقود المعتمدة في الـbaseline الحالي."
        />
        <AquaCard>
          <DemoHeading
            title="ملخص الإصدار"
            term="Manifest"
            description="بيانات ثابتة يستطيع المطور أو الاختبار قراءتها."
          />
          <AquaDetailList items={statusItems} columns={2} />
        </AquaCard>
      </div>
    </ShowcaseSection>
  )
}

function PublicSection({ onPrint }: { onPrint: () => void }) {
  return (
    <ShowcaseSection
      icon={<FileText />}
      kicker="PUBLIC & DOCUMENTS"
      title="الأسطح العامة والمستندات"
      description="هوية متصلة بين تسجيل الدخول والبريد والمخرجات القابلة للطباعة."
      action={
        <AquaButton
          variant="secondary"
          size="sm"
          leadingIcon={<Printer />}
          onClick={onPrint}
        >
          فتح معاينة الطباعة
        </AquaButton>
      }
    >
      <div className="aqua-showcase__public-layout">
        <AquaCard className="aqua-showcase__continuity-card">
          <DemoHeading
            title="استمرارية الهوية"
            term="Brand continuity"
            description="المستخدم يرى نفس العلامة في النقاط التي تسبق الـDashboard وتخرج منه."
          />
          <ol className="aqua-showcase__continuity-list">
            <li>
              <span>01</span>
              <div>
                <strong>صفحات المصادقة</strong>
                <p>تسجيل الدخول واستعادة كلمة المرور بقالب عام موحّد.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>البريد التشغيلي</strong>
                <p>قوالب مستقلة عن مزود الإرسال وقابلة للاختبار.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>المستندات والطباعة</strong>
                <p>غلاف ثابت وهوية واضحة مع قواعد طباعة A4.</p>
              </div>
            </li>
          </ol>
        </AquaCard>

        <div className="aqua-showcase__document-stage">
          <div className="aqua-showcase__document-toolbar">
            <div>
              <strong>معاينة شاشة مضبوطة</strong>
              <span>الطباعة الفعلية تستخدم قياس A4 دون الفراغ الطويل داخل الصفحة.</span>
            </div>
            <AquaBadge variant="blue" size="sm">
              A4 Print
            </AquaBadge>
          </div>
          <div className="aqua-showcase__document-preview">
            <AquaSystemDocument
              title="ملخص نظام التصميم"
              documentLabel="Design System Record"
              reference={`DS-${aquaDesignSystemVersion}`}
              issuedAt="2026-07-25"
              density="compact"
            >
              <AquaDetailList
                columns={2}
                items={[
                  { label: "الحالة", value: "Internal" },
                  {
                    label: "الحزمة",
                    value: aquaDesignSystemPackageName,
                    dir: "ltr",
                  },
                  {
                    label: "الإصدار",
                    value: aquaDesignSystemVersion,
                    dir: "ltr",
                  },
                  { label: "المصدر", value: "AquaFlow" },
                ]}
              />
              <div className="aqua-showcase__document-note">
                <strong>الغرض من المستند</strong>
                <p>
                  تسجيل الإصدار المعتمد ومصدره وحالته ضمن سجل يمكن طباعته أو تضمينه
                  في مخرجات النظام الرسمية.
                </p>
              </div>
            </AquaSystemDocument>
          </div>
        </div>
      </div>
    </ShowcaseSection>
  )
}

function GovernanceSection() {
  return (
    <ShowcaseSection
      icon={<PackageCheck />}
      kicker="PACKAGE & GOVERNANCE"
      title="الحزمة والحوكمة"
      description="أوامر قليلة، مصدر واحد، وترقية مقصودة بدل نسخ المكونات يدويًا."
    >
      <div className="aqua-showcase__governance-grid">
        <GovernanceCard
          step="01"
          title="مزامنة الحزمة"
          term="Package sync"
          command="npm run ds:check"
          description="يتأكد أن المكونات والعقود وCSS داخل الحزمة مطابقة للمصدر."
        />
        <GovernanceCard
          step="02"
          title="إنشاء مشروع جديد"
          term="Product starter"
          command="npm run ds:starter -- --name product-name"
          description="ينشئ Starter مع Bootstrap والحزمة وProduct Theme مضبوطة."
        />
        <GovernanceCard
          step="03"
          title="فحص البصمة"
          term="Visual baseline"
          command="npm run test:visual"
          description="يقارن العقود وCSS وبنية Showcase بالـbaseline المعتمد."
        />
        <GovernanceCard
          step="04"
          title="بوابة الإصدار"
          term="Release gate"
          command="npm run check"
          description="يشغّل المزامنة وLint وTypecheck والاختبارات والبناء الإنتاجي."
        />
      </div>

      <AquaAlert variant="warning" title="حدود الاختبار البصري">
        Visual Contract يكتشف تغييرات المصدر، لكنه لا يثبت أن كل شاشة جميلة أو مقروءة.
        لذلك تبقى مراجعة Desktop وMobile وRTL والتباين خطوة بشرية قبل الإصدار المستقر.
      </AquaAlert>
    </ShowcaseSection>
  )
}

function ShowcaseSection({
  icon,
  kicker,
  title,
  description,
  action,
  children,
}: {
  icon: React.ReactNode
  kicker: string
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="aqua-showcase__section">
      <header className="aqua-showcase__section-header">
        <div className="aqua-showcase__section-heading">
          <span className="aqua-showcase__section-icon" aria-hidden="true">
            {icon}
          </span>
          <div>
            <span className="aqua-showcase__eyebrow" dir="ltr">
              {kicker}
            </span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>
        {action ? <div className="aqua-showcase__section-action">{action}</div> : null}
      </header>
      <div className="aqua-showcase__section-body">{children}</div>
    </section>
  )
}

function DemoHeading({
  title,
  term,
  description,
}: {
  title: string
  term: string
  description: string
}) {
  return (
    <div className="aqua-showcase__demo-heading">
      <span className="aqua-showcase__technical-term" dir="ltr">
        {term}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

function GovernanceCard({
  step,
  title,
  term,
  command,
  description,
}: {
  step: string
  title: string
  term: string
  command: string
  description: string
}) {
  return (
    <AquaCard variant="outlined" className="aqua-showcase__governance-card">
      <div className="aqua-showcase__governance-head">
        <span>{step}</span>
        <CheckCircle2 aria-hidden="true" />
      </div>
      <div>
        <span className="aqua-showcase__technical-term" dir="ltr">
          {term}
        </span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <code dir="ltr">{command}</code>
    </AquaCard>
  )
}

function SectionIcon({ id }: { id: SectionId }) {
  if (id === "overview") return <LayoutGrid />
  if (id === "foundation") return <Sparkles />
  if (id === "actions") return <Component />
  if (id === "forms") return <Component />
  if (id === "workflows") return <Workflow />
  if (id === "public") return <FileText />
  return <PackageCheck />
}

function surfaceLabel(variant: (typeof aquaCardVariants)[number]) {
  if (variant === "soft") return "السطح الناعم"
  if (variant === "outlined") return "السطح المحدد"
  return "السطح الأساسي"
}

function buttonLabel(variant: (typeof aquaButtonVariants)[number]) {
  if (variant === "primary") return "إجراء رئيسي"
  if (variant === "secondary") return "إجراء ثانوي"
  if (variant === "ghost") return "إجراء هادئ"
  return "إجراء خطِر"
}
