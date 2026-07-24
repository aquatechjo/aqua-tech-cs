export default function AquaTechPattern() {
  return (
    <div className="aqua-tech-pattern" aria-hidden="true">
      <span className="aqua-tech-pattern__surface" />
      <span className="aqua-tech-pattern__glow" />
      <span className="aqua-tech-pattern__grid" />
      <span className="aqua-tech-pattern__symbol aqua-tech-pattern__symbol--code" dir="ltr">
        {"</>"}
      </span>
      <span className="aqua-tech-pattern__symbol aqua-tech-pattern__symbol--api" dir="ltr">
        {"{ API }"}
      </span>
      <span className="aqua-tech-pattern__symbol aqua-tech-pattern__symbol--sql" dir="ltr">
        SQL
      </span>
    </div>
  )
}
