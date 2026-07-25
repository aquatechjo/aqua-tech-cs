"use client"

import { Eye, EyeOff } from "lucide-react"
import { useId, useState, type ReactNode } from "react"

export default function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder = "••••••••••••",
  hint,
  error,
  labelAction,
  required = true,
}: {
  id?: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: "current-password" | "new-password"
  placeholder?: string
  hint?: string
  error?: string
  labelAction?: ReactNode
  required?: boolean
}) {
  const generatedId = useId()
  const controlId = id ?? `aqua-password-${generatedId}`
  const [visible, setVisible] = useState(false)
  const labelText = visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined

  return (
    <div className="aqua-field">
      <div className="aqua-field__label-row">
        <label className="aqua-field__label" htmlFor={controlId}>
          {label}
          {required ? (
            <span className="aqua-field__required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {labelAction}
      </div>

      <div className="aqua-password-field">
        <input
          id={controlId}
          dir="ltr"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`form-control aqua-control aqua-control--md text-start${
            error ? " aqua-control--invalid" : ""
          }`}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId ?? hintId}
        />
        <button
          type="button"
          className="aqua-password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={labelText}
          title={labelText}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </div>

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
