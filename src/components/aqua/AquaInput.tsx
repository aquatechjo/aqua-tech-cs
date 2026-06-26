import * as React from "react"
import { cn } from "@/lib/utils"

type AquaInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

export default function AquaInput({
  label,
  error,
  className,
  ...props
}: AquaInputProps) {
  return (
    <div>
      {label ? (
        <label className="mb-2 block text-sm font-medium text-slate-300">
          {label}
        </label>
      ) : null}

      <input
        className={cn(
          "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10",
          props.dir === "ltr" ? "text-left" : "text-right",
          error ? "border-red-400/40 focus:border-red-400 focus:ring-red-400/10" : "",
          className
        )}
        {...props}
      />

      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </div>
  )
}