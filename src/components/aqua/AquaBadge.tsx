import * as React from "react"
import { clsx } from "clsx"

import type {
  AquaBadgeSize,
  AquaBadgeVariant,
} from "@/design-system"

type AquaBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: AquaBadgeVariant
  size?: AquaBadgeSize
  dot?: boolean
}

const AquaBadge = React.forwardRef<HTMLSpanElement, AquaBadgeProps>(
  function AquaBadge(
    {
      children,
      variant = "aqua",
      size = "md",
      dot = false,
      className,
      ...props
    },
    ref
  ) {
    return (
      <span
        ref={ref}
        className={clsx(
          "badge aqua-badge",
          `aqua-badge--${variant}`,
          `aqua-badge--${size}`,
          className
        )}
        {...props}
      >
        {dot ? <span className="aqua-badge__dot" aria-hidden="true" /> : null}
        {children}
      </span>
    )
  }
)

AquaBadge.displayName = "AquaBadge"

export type { AquaBadgeProps }
export default AquaBadge
