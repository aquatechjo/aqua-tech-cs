"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileText,
  FolderKanban,
  Handshake,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Network,
  Palette,
  ReceiptText,
  SearchCheck,
  Settings,
  ShieldCheck,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react"

import type { AquaNavigationSection } from "@/design-system"

type AquaSidebarNavProps = {
  sections: AquaNavigationSection[]
  onNavigate?: () => void
}

const navigationIcons: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/my-day": CalendarCheck2,
  "/dashboard/tasks": ListTodo,
  "/dashboard/time": Clock3,
  "/dashboard/leads": SearchCheck,
  "/dashboard/discovery": ClipboardList,
  "/dashboard/pricing": CircleDollarSign,
  "/dashboard/proposals": FileText,
  "/dashboard/sales": Handshake,
  "/dashboard/service-requests": Inbox,
  "/dashboard/clients": Building2,
  "/dashboard/projects": FolderKanban,
  "/dashboard/finance": WalletCards,
  "/dashboard/team": UsersRound,
  "/dashboard/organization": Network,
  "/dashboard/hr": BriefcaseBusiness,
  "/dashboard/activity": ReceiptText,
  "/dashboard/design-system": Palette,
  "/dashboard/notifications": Bell,
  "/dashboard/settings": Settings,
}

function NavigationIcon({ href }: { href: string }) {
  const Icon = navigationIcons[href] ?? ShieldCheck

  return <Icon aria-hidden="true" focusable="false" />
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
                    <span className="aqua-nav-link__content">
                      <span className="aqua-nav-link__icon">
                        <NavigationIcon href={item.href} />
                      </span>
                      <span className="aqua-nav-link__label">{item.label}</span>
                    </span>
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
                  <span className="aqua-nav-link__content">
                    <span className="aqua-nav-link__icon">
                      <NavigationIcon href={item.href} />
                    </span>
                    <span className="aqua-nav-link__label">{item.label}</span>
                  </span>
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
