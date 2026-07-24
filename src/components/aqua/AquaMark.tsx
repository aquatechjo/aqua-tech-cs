import { clsx } from "clsx"

import { aquaFlowTheme } from "@/design-system"
import { aquaBrand } from "@/lib/brand"

type AquaMarkProps = {
  showText?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

export default function AquaMark({
  showText = true,
  size = "md",
  className,
}: AquaMarkProps) {
  return (
    <div
      className={clsx("aqua-brand-lockup", className)}
      aria-label={showText ? undefined : aquaBrand.product}
    >
      <span
        className={clsx("aqua-mark", `aqua-mark--${size}`)}
        aria-hidden="true"
      >
        {aquaFlowTheme.shortMark}
      </span>

      {showText ? (
        <span className="aqua-brand-lockup__copy">
          <span className="aqua-brand-lockup__name">{aquaBrand.product}</span>
          <span className="aqua-brand-lockup__tagline">
            {aquaBrand.language.tagline}
          </span>
        </span>
      ) : null}
    </div>
  )
}
