"use client"

import Link from "next/link"
import { clsx } from "clsx"

import type { AquaTabVariant } from "@/design-system"

type AquaTabItem = {
  id: string
  label: string
  href?: string
  count?: number
  disabled?: boolean
}

type AquaTabsProps = {
  items: AquaTabItem[]
  activeId: string
  variant?: AquaTabVariant
  label?: string
  onChange?: (id: string) => void
  className?: string
}

export default function AquaTabs({
  items,
  activeId,
  variant = "line",
  label = "أقسام الصفحة",
  onChange,
  className,
}: AquaTabsProps) {
  return (
    <div
      className={clsx("aqua-tabs", `aqua-tabs--${variant}`, className)}
      role="tablist"
      aria-label={label}
    >
      {items.map((item) => {
        const active = item.id === activeId
        const content = (
          <>
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span className="aqua-tabs__count">{item.count}</span>
            ) : null}
          </>
        )

        if (item.href && !item.disabled) {
          return (
            <Link
              key={item.id}
              href={item.href}
              className={clsx(
                "aqua-tabs__item",
                active && "aqua-tabs__item--active"
              )}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
            >
              {content}
            </Link>
          )
        }

        return (
          <button
            key={item.id}
            type="button"
            className={clsx(
              "aqua-tabs__item",
              active && "aqua-tabs__item--active"
            )}
            role="tab"
            aria-selected={active}
            aria-disabled={item.disabled || undefined}
            disabled={item.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange?.(item.id)}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}

export type { AquaTabItem, AquaTabsProps }
