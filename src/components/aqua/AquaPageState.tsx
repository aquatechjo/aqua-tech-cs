import {
  CheckCircle2,
  CircleAlert,
  Inbox,
  LockKeyhole,
} from "lucide-react"
import { clsx } from "clsx"

import type { AquaPageStateVariant } from "@/design-system"

import AquaSpinner from "./AquaSpinner"

type AquaPageStateProps = {
  variant: AquaPageStateVariant
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  compact?: boolean
  className?: string
}

function defaultIcon(variant: AquaPageStateVariant) {
  if (variant === "loading") return <AquaSpinner size="md" />
  if (variant === "error") return <CircleAlert />
  if (variant === "success") return <CheckCircle2 />
  if (variant === "permission") return <LockKeyhole />
  return <Inbox />
}

export default function AquaPageState({
  variant,
  title,
  description,
  action,
  icon,
  compact = false,
  className,
}: AquaPageStateProps) {
  const role = variant === "error" ? "alert" : "status"

  return (
    <div
      className={clsx(
        "aqua-page-state",
        `aqua-page-state--${variant}`,
        compact && "aqua-page-state--compact",
        className
      )}
      role={role}
      aria-live={variant === "loading" ? "polite" : undefined}
      aria-busy={variant === "loading" || undefined}
    >
      <div className="aqua-page-state__icon" aria-hidden="true">
        {icon ?? defaultIcon(variant)}
      </div>
      <h3 className="aqua-page-state__title">{title}</h3>
      {description ? (
        <p className="aqua-page-state__description">{description}</p>
      ) : null}
      {action ? <div className="aqua-page-state__action">{action}</div> : null}
    </div>
  )
}

export type { AquaPageStateProps }
