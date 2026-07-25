import * as React from "react"
import { clsx } from "clsx"

import type { AquaAlertVariant } from "../design-system"

type AquaAlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AquaAlertVariant
  title?: string
  icon?: React.ReactNode
}

const AquaAlert = React.forwardRef<HTMLDivElement, AquaAlertProps>(
  function AquaAlert(
    {
      children,
      variant = "info",
      title,
      icon,
      className,
      role,
      ...props
    },
    ref
  ) {
    const resolvedRole = role ?? (variant === "danger" ? "alert" : "status")

    return (
      <div
        ref={ref}
        className={clsx(
          "alert aqua-alert",
          `aqua-alert--${variant}`,
          className
        )}
        role={resolvedRole}
        {...props}
      >
        {icon ? (
          <span className="aqua-alert__icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <div className="aqua-alert__content">
          {title ? <strong className="aqua-alert__title">{title}</strong> : null}
          <div className="aqua-alert__message">{children}</div>
        </div>
      </div>
    )
  }
)

AquaAlert.displayName = "AquaAlert"

export type { AquaAlertProps }
export default AquaAlert
