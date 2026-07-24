import * as React from "react"
import { clsx } from "clsx"

import type { AquaFieldSize } from "@/design-system"

type AquaTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  hint?: string
  error?: string
  size?: AquaFieldSize
  wrapperClassName?: string
}

const AquaTextarea = React.forwardRef<HTMLTextAreaElement, AquaTextareaProps>(
  function AquaTextarea(
    {
      id,
      label,
      hint,
      error,
      size = "md",
      required,
      className,
      wrapperClassName,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) {
    const generatedId = React.useId()
    const controlId = id ?? `aqua-textarea-${generatedId}`
    const hintId = hint ? `${controlId}-hint` : undefined
    const errorId = error ? `${controlId}-error` : undefined
    const describedBy = [ariaDescribedBy, errorId, !error ? hintId : undefined]
      .filter(Boolean)
      .join(" ")

    return (
      <div className={clsx("aqua-field", wrapperClassName)}>
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

        <textarea
          ref={ref}
          id={controlId}
          required={required}
          className={clsx(
            "form-control aqua-control aqua-textarea",
            `aqua-control--${size}`,
            error && "aqua-control--invalid",
            className
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...props}
        />

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

AquaTextarea.displayName = "AquaTextarea"

export type { AquaTextareaProps }
export default AquaTextarea
