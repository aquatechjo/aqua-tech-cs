import { cn } from "@/lib/utils"

export default function AquaBackground({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <main
      className={cn(
        "relative min-h-screen overflow-hidden bg-slate-950 text-white",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.22),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="relative z-10">{children}</div>
    </main>
  )
}