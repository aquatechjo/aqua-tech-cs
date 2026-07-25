import * as React from "react"
import { clsx } from "clsx"

type AquaDataPanelProps = React.HTMLAttributes<HTMLElement> & {
  title: string
  description?: string
  eyebrow?: string
  meta?: React.ReactNode
  actions?: React.ReactNode
  footer?: React.ReactNode
  flush?: boolean
}

const AquaDataPanel = React.forwardRef<HTMLElement, AquaDataPanelProps>(
  function AquaDataPanel(
    {
      title,
      description,
      eyebrow,
      meta,
      actions,
      footer,
      flush = false,
      children,
      className,
      ...props
    },
    ref
  ) {
    return (
      <section
        ref={ref}
        className={clsx(
          "aqua-data-panel",
          flush && "aqua-data-panel--flush",
          className
        )}
        {...props}
      >
        <header className="aqua-data-panel__header">
          <div className="aqua-data-panel__heading">
            {eyebrow ? (
              <span className="aqua-data-panel__eyebrow">{eyebrow}</span>
            ) : null}
            <h2 className="aqua-data-panel__title">{title}</h2>
            {description ? (
              <p className="aqua-data-panel__description">{description}</p>
            ) : null}
          </div>

          <div className="aqua-data-panel__header-side">
            {meta ? <div className="aqua-data-panel__meta">{meta}</div> : null}
            {actions ? (
              <div className="aqua-data-panel__actions">{actions}</div>
            ) : null}
          </div>
        </header>

        <div className="aqua-data-panel__body">{children}</div>

        {footer ? (
          <footer className="aqua-data-panel__footer">{footer}</footer>
        ) : null}
      </section>
    )
  }
)

AquaDataPanel.displayName = "AquaDataPanel"

export type { AquaDataPanelProps }
export default AquaDataPanel
