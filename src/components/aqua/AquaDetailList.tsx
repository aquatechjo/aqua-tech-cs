import { clsx } from "clsx"

import type { AquaDetailColumns } from "@/design-system"

type AquaDetailItem = {
  label: string
  value: React.ReactNode
  hint?: string
  fullWidth?: boolean
  dir?: "rtl" | "ltr" | "auto"
}

type AquaDetailListProps = {
  items: AquaDetailItem[]
  columns?: AquaDetailColumns
  className?: string
}

export default function AquaDetailList({
  items,
  columns = 2,
  className,
}: AquaDetailListProps) {
  return (
    <dl
      className={clsx("aqua-detail-list", className)}
      data-aqua-columns={columns}
    >
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className={clsx(
            "aqua-detail-list__item",
            item.fullWidth && "aqua-detail-list__item--full"
          )}
        >
          <dt className="aqua-detail-list__label">{item.label}</dt>
          <dd className="aqua-detail-list__value" dir={item.dir}>
            {item.value ?? "—"}
          </dd>
          {item.hint ? (
            <span className="aqua-detail-list__hint">{item.hint}</span>
          ) : null}
        </div>
      ))}
    </dl>
  )
}

export type { AquaDetailItem, AquaDetailListProps }
