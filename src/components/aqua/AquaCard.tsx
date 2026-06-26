import * as React from "react"
import { cn } from "@/lib/utils"

type AquaCardProps = React.HTMLAttributes<HTMLDivElement> & {
  glow?: boolean
}

export default function AquaCard({
  className,
  glow = false,
  ...props
}: AquaCardProps) {
  return (
    <div
      className={cn(
        "rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 backdrop-blur",
        glow ? "shadow-2xl shadow-cyan-950/40" : "shadow-xl shadow-slate-950/20",
        className
      )}
      {...props}
    />
  )
}