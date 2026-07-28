import * as React from "react"
import { clsx } from "clsx"

import type { AquaFieldSize } from "@/design-system"

type AquaSelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "size"
> & {
  label?: string
  hint?: string
  error?: string
  size?: AquaFieldSize
  wrapperClassName?: string
  span?: 2 | 3 | 4 | 6 | 12
}

const AquaSelect = React.forwardRef<HTMLSelectElement, AquaSelectProps>(
  function AquaSelect(
    {
      id,
      label,
      hint,
      error,
      size = "md",
      required,
      className,
      wrapperClassName,
      span,
      "aria-describedby": ariaDescribedBy,
      children,
      ...props
    },
    ref
  ) {
    const generatedId = React.useId()
    const controlId = id ?? `aqua-select-${generatedId}`
    const hintId = hint ? `${controlId}-hint` : undefined
    const errorId = error ? `${controlId}-error` : undefined
    const describedBy = [ariaDescribedBy, errorId, !error ? hintId : undefined]
      .filter(Boolean)
      .join(" ")

    return (
      <div
        className={clsx("aqua-field", wrapperClassName)}
        data-aqua-span={span}
      >
        {label ? (
          <label className="aqua-field__label" htmlFor={controlId}>
            {label}
            {required ? (
              <span className="aqua-field__required" aria-hidden="true">
                *
              </span>
            ) : null}
          </label>
        ) : null}

        <select
          ref={ref}
          id={controlId}
          required={required}
          className={clsx(
            "form-select aqua-control aqua-select",
            `aqua-control--${size}`,
            error && "aqua-control--invalid",
            className
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...props}
        >
          {children}
        </select>

        {error ? (
          <p id={errorId} className="aqua-field__message aqua-field__message--error">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="aqua-field__message">
            {hint}
          </p>
        ) : null}
      </div>
    )
  }
)

AquaSelect.displayName = "AquaSelect"

export type { AquaSelectProps }
export default AquaSelect
