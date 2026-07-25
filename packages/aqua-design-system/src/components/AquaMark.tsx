import { clsx } from "clsx"

import type { AquaProductTheme } from "../design-system"
import { aquaFlowTheme } from "../design-system"

type AquaMarkProps = {
  showText?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
  theme?: AquaProductTheme
}

export default function AquaMark({
  showText = true,
  size = "md",
  className,
  theme = aquaFlowTheme,
}: AquaMarkProps) {
  return (
    <div
      className={clsx("aqua-brand-lockup", className)}
      aria-label={showText ? undefined : theme.productName}
    >
      <span
        className={clsx("aqua-mark", `aqua-mark--${size}`)}
        aria-hidden="true"
      >
        {theme.shortMark}
      </span>

      {showText ? (
        <span className="aqua-brand-lockup__copy">
          <span className="aqua-brand-lockup__name">{theme.productName}</span>
          <span className="aqua-brand-lockup__tagline">{theme.tagline}</span>
        </span>
      ) : null}
    </div>
  )
}

export type { AquaMarkProps }
