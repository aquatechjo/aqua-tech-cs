import * as React from "react"
import { clsx } from "clsx"

type AquaFormSectionProps = React.HTMLAttributes<HTMLElement> & {
  title: string
  description?: string
  eyebrow?: string
  actions?: React.ReactNode
  footer?: React.ReactNode
}

const AquaFormSection = React.forwardRef<HTMLElement, AquaFormSectionProps>(
  function AquaFormSection(
    {
      title,
      description,
      eyebrow,
      actions,
      footer,
      children,
      className,
      ...props
    },
    ref
  ) {
    return (
      <section
        ref={ref}
        className={clsx("aqua-form-section", className)}
        {...props}
      >
        <header className="aqua-form-section__header">
          <div className="aqua-form-section__heading">
            {eyebrow ? (
              <span className="aqua-form-section__eyebrow">{eyebrow}</span>
            ) : null}
            <h2 className="aqua-form-section__title">{title}</h2>
            {description ? (
              <p className="aqua-form-section__description">{description}</p>
            ) : null}
          </div>

          {actions ? (
            <div className="aqua-form-section__header-actions">{actions}</div>
          ) : null}
        </header>

        <div className="aqua-form-section__body">{children}</div>

        {footer ? (
          <footer className="aqua-form-section__footer">{footer}</footer>
        ) : null}
      </section>
    )
  }
)

AquaFormSection.displayName = "AquaFormSection"

export type { AquaFormSectionProps }
export default AquaFormSection
