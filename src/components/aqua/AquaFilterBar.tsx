import * as React from "react"
import { clsx } from "clsx"

type AquaFilterBarProps = React.FormHTMLAttributes<HTMLFormElement> & {
  title?: string
  description?: string
  activeCount?: number
  actions?: React.ReactNode
}

const AquaFilterBar = React.forwardRef<HTMLFormElement, AquaFilterBarProps>(
  function AquaFilterBar(
    {
      title = "البحث والتصفية",
      description,
      activeCount = 0,
      actions,
      children,
      className,
      ...props
    },
    ref
  ) {
    return (
      <form
        ref={ref}
        className={clsx("aqua-filter-bar", className)}
        {...props}
      >
        <div className="aqua-filter-bar__header">
          <div>
            <div className="aqua-filter-bar__title-row">
              <h3 className="aqua-filter-bar__title">{title}</h3>
              {activeCount > 0 ? (
                <span className="aqua-filter-bar__count" aria-label={`${activeCount} فلاتر مفعلة`}>
                  {activeCount}
                </span>
              ) : null}
            </div>
            {description ? (
              <p className="aqua-filter-bar__description">{description}</p>
            ) : null}
          </div>

          {actions ? (
            <div className="aqua-filter-bar__header-actions">{actions}</div>
          ) : null}
        </div>

        <div className="aqua-filter-bar__fields">{children}</div>
      </form>
    )
  }
)

AquaFilterBar.displayName = "AquaFilterBar"

export type { AquaFilterBarProps }
export default AquaFilterBar
