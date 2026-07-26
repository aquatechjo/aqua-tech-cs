import { Blocks, ShieldCheck, Workflow } from "lucide-react"
import type { ReactNode } from "react"

import {
  AquaBadge,
  AquaCard,
  AquaMark,
  AquaTechPattern,
} from "@/components/aqua"

const operatingPillars = [
  {
    icon: Blocks,
    title: "بيانات موحّدة",
    description: "العملاء والمشاريع والمالية ضمن سياق تشغيلي واحد.",
  },
  {
    icon: ShieldCheck,
    title: "وصول محكوم",
    description: "صلاحيات واضحة وجلسات آمنة ومسارات استعادة محمية.",
  },
  {
    icon: Workflow,
    title: "سير عمل قابل للتوسع",
    description: "أنماط ثابتة تدعم نمو الفريق والعمليات دون فوضى.",
  },
] as const

type AuthShellProps = {
  children: ReactNode
  title: string
  description: string
  eyebrow?: string
}

export default function AuthShell({
  children,
  title,
  description,
  eyebrow = "Aqua tech CS",
}: AuthShellProps) {
  return (
    <main className="aqua-public-surface aqua-public-surface--auth">
      <a className="aqua-public-skip-link" href="#aqua-auth-content">
        الانتقال إلى النموذج
      </a>

      <AquaTechPattern />

      <div className="container aqua-public-surface__container">
        <div className="aqua-public-surface__layout">
          <section
            className="aqua-public-story"
            aria-labelledby="aqua-public-story-title"
          >
            <AquaBadge dot>{eyebrow}</AquaBadge>

            <h2 id="aqua-public-story-title" className="aqua-public-story__title">
              تشغيل أوضح.
              <span>قرارات أسرع.</span>
            </h2>

            <p className="aqua-public-story__description">
              Aqua tech CS يوحّد تشغيل Aqua.Tech من أول طلب خدمة إلى التنفيذ
              والتحصيل والمتابعة، ضمن تجربة واحدة متماسكة وآمنة.
            </p>

            <div className="aqua-public-story__pillars">
              {operatingPillars.map(({ icon: Icon, title: itemTitle, description: itemDescription }) => (
                <article className="aqua-public-pillar" key={itemTitle}>
                  <span className="aqua-public-pillar__icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3>{itemTitle}</h3>
                    <p>{itemDescription}</p>
                  </div>
                </article>
              ))}
            </div>

            <p className="aqua-public-story__signature" dir="ltr">
              Growth • Software • AI
            </p>
          </section>

          <section
            id="aqua-auth-content"
            className="aqua-public-auth"
            aria-labelledby="aqua-auth-title"
            tabIndex={-1}
          >
            <AquaCard
              variant="surface"
              padding="lg"
              glow
              className="aqua-public-auth__card"
            >
              <header className="aqua-public-auth__brand">
                <AquaMark size="md" />
                <AquaBadge variant="muted" size="sm">
                  وصول داخلي آمن
                </AquaBadge>
              </header>

              <div className="aqua-public-auth__heading">
                <h1 id="aqua-auth-title">{title}</h1>
                <p>{description}</p>
              </div>

              {children}

              <footer className="aqua-public-auth__footer">
                <span>Aqua.Tech</span>
                <span aria-hidden="true">•</span>
                <span>Aqua tech CS</span>
              </footer>
            </AquaCard>
          </section>
        </div>
      </div>
    </main>
  )
}
