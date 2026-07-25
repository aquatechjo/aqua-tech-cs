import { clsx } from "clsx"

export default function AquaBackground({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <main className={clsx("aqua-background", className)}>
      <span className="aqua-background__glow" aria-hidden="true" />
      <span className="aqua-background__grid" aria-hidden="true" />
      <div className="aqua-background__content">{children}</div>
    </main>
  )
}
