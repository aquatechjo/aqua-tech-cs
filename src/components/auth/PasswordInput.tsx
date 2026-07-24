"use client"

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"

export default function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder = "••••••••••••",
  required = true,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete: "current-password" | "new-password"
  placeholder?: string
  required?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const label = visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"

  return (
    <div className="aqua-password-field">
      <input
        id={id}
        dir="ltr"
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="form-control aqua-control text-start"
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
      />
      <button
        type="button"
        className="aqua-password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={label}
        title={label}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  )
}
