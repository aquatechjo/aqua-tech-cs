import type { ReactNode } from "react"

type AquaPageHeaderProps = {
  badge: string
  title: string
  description: string
  brandKicker?: string
  brandValue?: string
  actions?: ReactNode
  meta?: ReactNode
}

export default function AquaPageHeader({
  badge,
  title,
  description,
  brandKicker = "AQUA.TECH CORE SYSTEM",
  brandValue = "Aqua tech CS",
  actions,
  meta,
}: AquaPageHeaderProps) {
  return (
    <header className="aqua-card aqua-page-header">
      <div className="aqua-page-header__main">
        <div className="aqua-page-header__copy">
          <div className="aqua-page-header__context">
            <span className="aqua-badge">{badge}</span>
            <span
              className="aqua-page-header__section"
              title={brandKicker}
              dir="ltr"
            >
              {brandValue}
            </span>
          </div>

          <h2 className="aqua-page-header-title">{title}</h2>

          <p className="aqua-page-header-desc">{description}</p>
        </div>

        {actions ? (
          <div className="aqua-page-header__actions">{actions}</div>
        ) : null}
      </div>

      {meta ? <div className="aqua-page-header__meta">{meta}</div> : null}
    </header>
  )
}
