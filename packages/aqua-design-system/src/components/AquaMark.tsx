import { clsx } from "clsx"
import Image from "next/image"

import type { AquaProductTheme } from "../design-system"
import { aquaTechCsTheme } from "../design-system"

type AquaMarkProps = {
  showText?: boolean
  showTagline?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
  theme?: AquaProductTheme
}

export default function AquaMark({
  showText = true,
  showTagline = true,
  size = "md",
  className,
  theme = aquaTechCsTheme,
}: AquaMarkProps) {
  return (
    <div
      className={clsx("aqua-brand-lockup", className)}
      aria-label={showText ? undefined : theme.productName}
    >
      <span
        className={clsx(
          "aqua-mark",
          `aqua-mark--${size}`,
          theme.logoSrc && "aqua-mark--image"
        )}
        aria-hidden="true"
      >
        {theme.logoSrc ? (
          <Image
            className="aqua-mark__image"
            src={theme.logoSrc}
            alt=""
            width={96}
            height={96}
            sizes="64px"
          />
        ) : (
          theme.shortMark
        )}
      </span>

      {showText ? (
        <span className="aqua-brand-lockup__copy">
          <span className="aqua-brand-lockup__name">{theme.productName}</span>
          {showTagline ? (
            <span className="aqua-brand-lockup__tagline">{theme.tagline}</span>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}

export type { AquaMarkProps }
