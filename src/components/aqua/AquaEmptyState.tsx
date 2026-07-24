import { clsx } from "clsx"

import AquaCard from "./AquaCard"

type AquaEmptyStateProps = {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  compact?: boolean
  className?: string
}

export default function AquaEmptyState({
  title,
  description,
  icon,
  action,
  compact = false,
  className,
}: AquaEmptyStateProps) {
  return (
    <AquaCard
      variant="soft"
      padding={compact ? "sm" : "lg"}
      className={clsx(
        "aqua-empty-state",
        compact && "aqua-empty-state--compact",
        className
      )}
    >
      {icon ? (
        <div className="aqua-empty-state__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h2 className="aqua-empty-state__title">{title}</h2>
      {description ? (
        <p className="aqua-empty-state__description">{description}</p>
      ) : null}
      {action ? <div className="aqua-empty-state__action">{action}</div> : null}
    </AquaCard>
  )
}
