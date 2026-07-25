"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import type { AquaNavigationSection } from "@/design-system"

type AquaSidebarNavProps = {
  sections: AquaNavigationSection[]
  onNavigate?: () => void
}

export default function AquaSidebarNav({
  sections,
  onNavigate,
}: AquaSidebarNavProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }

    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <nav className="aqua-sidebar-nav" aria-label="التنقل الرئيسي">
      {sections.map((section) => (
        <section className="aqua-sidebar-nav__section" key={section.label}>
          <h2 className="aqua-sidebar-nav__label">{section.label}</h2>

          <div className="aqua-sidebar-nav__items">
            {section.items.map((item) => {
              if (!item.enabled) {
                return (
                  <span
                    key={item.href}
                    className="aqua-nav-link aqua-nav-link--disabled"
                    aria-disabled="true"
                  >
                    <span>{item.label}</span>
                    <span className="aqua-nav-link__meta">غير متاح</span>
                  </span>
                )
              }

              const active = isActive(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`aqua-nav-link ${
                    active ? "aqua-nav-link--active" : ""
                  }`}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <span>{item.label}</span>
                  <span className="aqua-nav-dot" aria-hidden="true" />
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </nav>
  )
}
