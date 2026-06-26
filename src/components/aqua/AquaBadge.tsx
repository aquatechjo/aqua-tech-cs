import { cn } from "@/lib/utils"

type AquaBadgeProps = {
  children: React.ReactNode
  variant?: "aqua" | "blue" | "success" | "warning" | "danger" | "muted"
  className?: string
}

export default function AquaBadge({
  children,
  variant = "aqua",
  className,
}: AquaBadgeProps) {
  const variants = {
    aqua: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
    blue: "border-blue-400/20 bg-blue-400/10 text-blue-200",
    success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    danger: "border-red-400/20 bg-red-400/10 text-red-200",
    muted: "border-white/10 bg-white/[0.04] text-slate-300",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}