import * as React from "react"
import { cn } from "@/lib/utils"

type AquaButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
}

export default function AquaButton({
  className,
  variant = "primary",
  size = "md",
  ...props
}: AquaButtonProps) {
  const variants = {
    primary:
      "bg-gradient-to-r from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-300 hover:to-blue-500",
    secondary:
      "border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15",
    ghost:
      "border border-white/10 bg-white/[0.04] text-slate-200 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200",
    danger:
      "border border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/15",
  }

  const sizes = {
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-3 text-sm",
    lg: "px-5 py-4 text-base",
  }

  return (
    <button
      className={cn(
        "rounded-2xl font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
}