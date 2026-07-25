import Link, { type LinkProps } from "next/link"
import * as React from "react"
import { clsx } from "clsx"

import type {
  AquaButtonSize,
  AquaButtonVariant,
} from "../design-system"

type AquaLinkButtonProps = LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    variant?: AquaButtonVariant
    size?: AquaButtonSize
    fullWidth?: boolean
    leadingIcon?: React.ReactNode
    trailingIcon?: React.ReactNode
  }

const AquaLinkButton = React.forwardRef<HTMLAnchorElement, AquaLinkButtonProps>(
  function AquaLinkButton(
    {
      children,
      className,
      variant = "primary",
      size = "md",
      fullWidth = false,
      leadingIcon,
      trailingIcon,
      ...props
    },
    ref
  ) {
    return (
      <Link
        ref={ref}
        className={clsx(
          "btn aqua-button",
          `aqua-button--${variant}`,
          `aqua-button--${size}`,
          fullWidth && "aqua-button--block",
          className
        )}
        {...props}
      >
        {leadingIcon ? (
          <span className="aqua-button__icon" aria-hidden="true">
            {leadingIcon}
          </span>
        ) : null}

        <span className="aqua-button__label">{children}</span>

        {trailingIcon ? (
          <span className="aqua-button__icon" aria-hidden="true">
            {trailingIcon}
          </span>
        ) : null}
      </Link>
    )
  }
)

AquaLinkButton.displayName = "AquaLinkButton"

export type { AquaLinkButtonProps }
export default AquaLinkButton
