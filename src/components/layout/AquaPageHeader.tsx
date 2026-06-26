type AquaPageHeaderProps = {
  badge: string
  title: string
  description: string
  brandKicker?: string
  brandValue?: string
}

export default function AquaPageHeader({
  badge,
  title,
  description,
  brandKicker = "AQUA.TECH OS",
  brandValue = "AquaFlow",
}: AquaPageHeaderProps) {
  return (
    <div className="aqua-card aqua-page-header">
      <div className="row g-3 align-items-center">
        <div className="col-12 col-lg">
          <span className="aqua-badge">{badge}</span>

          <h2 className="aqua-page-header-title">{title}</h2>

          <p className="aqua-page-header-desc">{description}</p>
        </div>

        <div className="col-12 col-lg-auto">
          <div className="aqua-page-brand-box text-start" dir="ltr">
            <div className="brand-kicker">{brandKicker}</div>
            <div className="brand-value aqua-text-gradient">{brandValue}</div>
          </div>
        </div>
      </div>
    </div>
  )
}