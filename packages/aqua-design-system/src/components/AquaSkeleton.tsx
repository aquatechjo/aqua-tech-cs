import * as React from "react"
import { clsx } from "clsx"

import type { AquaSkeletonShape } from "../design-system"

type AquaSkeletonProps = React.HTMLAttributes<HTMLSpanElement> & {
  shape?: AquaSkeletonShape
  width?: string | number
  height?: string | number
}

export default function AquaSkeleton({
  shape = "text",
  width,
  height,
  className,
  style,
  ...props
}: AquaSkeletonProps) {
  return (
    <span
      className={clsx(
        "aqua-skeleton",
        `aqua-skeleton--${shape}`,
        className
      )}
      aria-hidden="true"
      style={{ width, height, ...style }}
      {...props}
    />
  )
}
