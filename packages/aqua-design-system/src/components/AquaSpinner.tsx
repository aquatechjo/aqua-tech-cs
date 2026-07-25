import { clsx } from "clsx"

import type { AquaSpinnerSize } from "../design-system"

type AquaSpinnerProps = {
  size?: AquaSpinnerSize
  label?: string
  className?: string
}

export default function AquaSpinner({
  size = "md",
  label = "جارٍ التحميل",
  className,
}: AquaSpinnerProps) {
  return (
    <span
      className={clsx("aqua-spinner", `aqua-spinner--${size}`, className)}
      role="status"
    >
      <span className="aqua-spinner__ring" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </span>
  )
}
