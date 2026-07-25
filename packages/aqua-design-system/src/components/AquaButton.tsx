import * as React from "react"
import { clsx } from "clsx"

import type {
  AquaButtonSize,
  AquaButtonVariant,
} from "../design-system"

type AquaButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AquaButtonVariant
  size?: AquaButtonSize
  loading?: boolean
  loadingLabel?: string
  fullWidth?: boolean
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
}

const AquaButton = React.forwardRef<HTMLButtonElement, AquaButtonProps>(
  function AquaButton(
    {
      children,
      className,
      variant = "primary",
      size = "md",
      loading = false,
      loadingLabel = "جارٍ التنفيذ",
      fullWidth = false,
      leadingIcon,
      trailingIcon,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        className={clsx(
          "btn aqua-button",
          `aqua-button--${variant}`,
          `aqua-button--${size}`,
          fullWidth && "aqua-button--block",
          className
        )}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <span className="aqua-button__spinner" aria-hidden="true" />
        ) : (
          leadingIcon && (
            <span className="aqua-button__icon" aria-hidden="true">
              {leadingIcon}
            </span>
          )
        )}

        <span className="aqua-button__label">
          {loading ? loadingLabel : children}
        </span>

        {!loading && trailingIcon ? (
          <span className="aqua-button__icon" aria-hidden="true">
            {trailingIcon}
          </span>
        ) : null}
      </button>
    )
  }
)

AquaButton.displayName = "AquaButton"

export type { AquaButtonProps }
export default AquaButton
