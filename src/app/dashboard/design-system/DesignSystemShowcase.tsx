"use client"

import { useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronLeft,
  Component,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import {
  AquaAlert,
  AquaBadge,
  AquaButton,
  AquaCard,
  AquaDataPanel,
  AquaDetailList,
  AquaInput,
  AquaMark,
  AquaPageState,
  AquaSelect,
  AquaSpinner,
  AquaSystemDocument,
  AquaTable,
  AquaTabs,
  AquaTextarea,
} from "@/components/aqua"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
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
      ? "Compact"
      : density === "spacious"
        ? "Spacious"
        : "Comfortable",
}))

const statusItems = [
  { label: "الحزمة", value: aquaDesignSystemPackageName, dir: "ltr" as const },
  { label: "الإصدار", value: aquaDesignSystemVersion, dir: "ltr" as const },
  { label: "طبقات CSS", value: aquaDesignSystemCssLayers.length },
  {
    label: "المكونات",
    value: Object.values(aquaDesignSystemComponentGroups).flat().length,
  },
]

export default function DesignSystemShowcase() {
  const [density, setDensity] = useState<(typeof aquaStarterDensities)[number]>(
    "comfortable"
  )
  const [loading, setLoading] = useState(false)

  const sections = useMemo(
    () => aquaDesignSystemShowcase.sections.map((section) => section.id),
    []
  )

  function simulateLoading() {
    setLoading(true)
    window.setTimeout(() => setLoading(false), 900)
  }

  return (
    <div
      className="aqua-showcase"
      data-aqua-showcase-version={aquaDesignSystemVersion}
      data-aqua-density={density}
    >
      <AquaPageHeader
        badge="DS-06"
        title="Aqua.Tech Design System"
        description="مرجع حي للمكونات، الحزمة، الـStarter، وقواعد الحوكمة والإصدار."
        brandKicker="PACKAGE"
        brandValue={`v${aquaDesignSystemVersion}`}
      />

      <AquaCard className="aqua-showcase__toolbar" padding="sm">
        <div>
          <span className="aqua-showcase__eyebrow">Preview density</span>
          <strong>عاين المكونات بالكثافة المعتمدة</strong>
        </div>
        <AquaTabs
          items={densityTabs}
          activeId={density}
          variant="pill"
          label="كثافة المعاينة"
          onChange={(value) =>
            setDensity(value as (typeof aquaStarterDensities)[number])
          }
        />
      </AquaCard>

      <section className="aqua-showcase__section" id="foundation">
        <ShowcaseHeading
          icon={<Sparkles />}
          title="الأساس والهوية"
          description="DNA ثابت مع مساحة Product Personality مضبوطة."
        />

        <div className="aqua-showcase__grid aqua-showcase__grid--foundation">
          <AquaCard glow>
            <AquaMark size="lg" />
            <p className="aqua-showcase__muted">
              Brand lockup يستقبل Product Theme بدل الاعتماد على AquaFlow مباشرة.
            </p>
            <div className="aqua-showcase__badge-row">
              {aquaBadgeVariants.map((variant) => (
                <AquaBadge key={variant} variant={variant} size="sm">
                  {variant}
                </AquaBadge>
              ))}
            </div>
          </AquaCard>

          {aquaCardVariants.map((variant) => (
            <AquaCard key={variant} variant={variant}>
              <AquaBadge variant="blue" size="sm">
                {variant}
              </AquaBadge>
              <h3>سطح {variant}</h3>
              <p className="aqua-showcase__muted">
                مخصص للتجميع البصري دون إنشاء recipe جديد داخل الصفحة.
              </p>
            </AquaCard>
          ))}
        </div>
      </section>

      <section className="aqua-showcase__section" id="actions">
        <ShowcaseHeading
          icon={<Component />}
          title="الإجراءات والحالات"
          description="Variants مقيدة، واضحة، ومتوافقة مع لوحة المفاتيح."
        />

        <AquaDataPanel
          title="Buttons and feedback"
          description="الحالات الأساسية التي يسمح بها عقد DS-02."
        >
          <div className="aqua-showcase__button-row">
            <span className="aqua-showcase__spinner-demo">
              <AquaSpinner size="sm" />
              Ready
            </span>
            {aquaButtonVariants.map((variant) => (
              <AquaButton key={variant} variant={variant}>
                {variant}
              </AquaButton>
            ))}
            <AquaButton
              loading={loading}
              loadingLabel="جارٍ الفحص"
              leadingIcon={<ShieldCheck />}
              onClick={simulateLoading}
            >
              تشغيل حالة التحميل
            </AquaButton>
          </div>

          <div className="aqua-showcase__alerts">
            <AquaAlert variant="success" title="الحزمة متزامنة">
              المصدر داخل AquaFlow مطابق لنسخة package القابلة لإعادة الاستخدام.
            </AquaAlert>
            <AquaAlert variant="warning" title="تغيير بصري مقصود">
              حدّث baseline فقط بعد مراجعة RTL وMobile والتباين.
            </AquaAlert>
          </div>
        </AquaDataPanel>
      </section>

      <section className="aqua-showcase__section" id="forms">
        <ShowcaseHeading
          icon={<Component />}
          title="النماذج والحقول"
          description="Labels، hints، errors، وlogical sizing بعقد واحد."
        />

        <AquaCard>
          <div className="aqua-showcase__form-grid">
            <AquaInput
              label="اسم المنتج"
              defaultValue="AquaFlow"
              hint="اسم واضح وقصير"
            />
            <AquaSelect label="الشخصية">
              <option>Operational</option>
              <option>Professional</option>
              <option>Intelligent</option>
              <option>Expressive</option>
            </AquaSelect>
            <AquaInput
              label="معرّف الحزمة"
              defaultValue="@aqua-tech/design-system"
              error="مثال لحالة خطأ مرئية"
              dir="ltr"
            />
            <AquaTextarea
              label="ملاحظات الإصدار"
              defaultValue="توثيق سبب التغيير ونطاقه قبل تحديث الإصدار."
              wrapperClassName="aqua-showcase__form-wide"
            />
          </div>
        </AquaCard>
      </section>

      <section className="aqua-showcase__section" id="workflows">
        <ShowcaseHeading
          icon={<Component />}
          title="البيانات والـWorkflows"
          description="نفس البنية تعمل في الجداول، التفاصيل، والحالات الفارغة."
        />

        <AquaDataPanel
          title="Release readiness"
          description="حالة البوابات المطلوبة قبل أي إصدار Design System."
          meta={<AquaBadge variant="success" dot>Ready</AquaBadge>}
          footer="المصدر: DS-06 governance manifest"
        >
          <AquaTable
            caption="بوابات إصدار نظام التصميم"
            mobileStrategy="stack"
          >
            <thead>
              <tr>
                <th>البوابة</th>
                <th>الحالة</th>
                <th>الهدف</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Package sync", "ناجح", "منع اختلاف المصدر عن الحزمة"],
                ["Visual contract", "ناجح", "كشف التغيير البصري غير المقصود"],
                ["Quality gate", "مطلوب", "Lint + Typecheck + Tests + Build"],
              ].map(([gate, state, goal]) => (
                <tr key={gate}>
                  <td data-label="البوابة" dir="ltr">{gate}</td>
                  <td data-label="الحالة">
                    <AquaBadge variant={state === "ناجح" ? "success" : "warning"}>
                      {state}
                    </AquaBadge>
                  </td>
                  <td data-label="الهدف">{goal}</td>
                </tr>
              ))}
            </tbody>
          </AquaTable>
        </AquaDataPanel>

        <div className="aqua-showcase__grid aqua-showcase__grid--states">
          <AquaPageState
            variant="empty"
            title="لا توجد انحرافات"
            description="لا توجد ألوان أو variants خارج العقود المعتمدة."
          />
          <AquaCard>
            <AquaDetailList items={statusItems} columns={2} />
          </AquaCard>
        </div>
      </section>

      <section className="aqua-showcase__section" id="public">
        <ShowcaseHeading
          icon={<Sparkles />}
          title="الأسطح العامة والمستندات"
          description="هوية متصلة بين الدخول، الرسائل، والمخرجات القابلة للطباعة."
        />

        <div className="aqua-showcase__document-wrap">
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
                { label: "الحزمة", value: aquaDesignSystemPackageName, dir: "ltr" },
                { label: "الإصدار", value: aquaDesignSystemVersion, dir: "ltr" },
                { label: "المصدر", value: "AquaFlow" },
              ]}
            />
          </AquaSystemDocument>
        </div>
      </section>

      <section className="aqua-showcase__section" id="governance">
        <ShowcaseHeading
          icon={<PackageCheck />}
          title="الحزمة والحوكمة"
          description="إصدار واحد، source of truth واحد، وترقية مقصودة."
        />

        <div className="aqua-showcase__governance-grid">
          <GovernanceCard
            title="Package sync"
            command="npm run ds:check"
            description="يتأكد أن المكونات والعقود وCSS داخل package مطابقة للمصدر."
          />
          <GovernanceCard
            title="Product starter"
            command="npm run ds:starter -- --name product-name"
            description="ينشئ Next.js starter مع Bootstrap وربط الحزمة وProduct Theme."
          />
          <GovernanceCard
            title="Visual baseline"
            command="npm run test:visual"
            description="يقارن البصمة الثابتة للعقود والـCSS والـShowcase بالـbaseline المعتمد."
          />
          <GovernanceCard
            title="Release gate"
            command="npm run check"
            description="بوابة الجودة الكاملة قبل Commit أو رفع إصدار جديد."
          />
        </div>

        <AquaAlert variant="info" title="حدود الاختبار البصري">
          Visual Contract يكشف تغييرات المصدر والـCSS، لكنه لا يستبدل مراجعة screenshot
          فعلية على المتصفح قبل نشر package مستقرة خارج Aqua.Tech.
        </AquaAlert>
      </section>

      <nav className="aqua-showcase__index" aria-label="فهرس أقسام Showcase">
        {sections.map((section) => (
          <a key={section} href={`#${section}`}>
            <ChevronLeft aria-hidden="true" />
            {section}
          </a>
        ))}
      </nav>
    </div>
  )
}

function ShowcaseHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <header className="aqua-showcase__heading">
      <span className="aqua-showcase__heading-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  )
}

function GovernanceCard({
  title,
  command,
  description,
}: {
  title: string
  command: string
  description: string
}) {
  return (
    <AquaCard variant="outlined">
      <div className="aqua-showcase__governance-title">
        <CheckCircle2 aria-hidden="true" />
        <h3>{title}</h3>
      </div>
      <code dir="ltr">{command}</code>
      <p className="aqua-showcase__muted">{description}</p>
    </AquaCard>
  )
}
