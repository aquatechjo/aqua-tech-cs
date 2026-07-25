import * as React from "react"
import { clsx } from "clsx"

import type {
  AquaCardPadding,
  AquaCardVariant,
} from "../design-system"

type AquaCardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AquaCardVariant
  padding?: AquaCardPadding
  glow?: boolean
}

const AquaCard = React.forwardRef<HTMLDivElement, AquaCardProps>(
  function AquaCard(
    {
      className,
      variant = "surface",
      padding = "md",
      glow = false,
      ...props
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={clsx(
          "aqua-card",
          `aqua-card--${variant}`,
          `aqua-card--padding-${padding}`,
          glow && "aqua-card--glow",
          className
        )}
        {...props}
      />
    )
  }
)

AquaCard.displayName = "AquaCard"

export type { AquaCardProps }
export default AquaCard
