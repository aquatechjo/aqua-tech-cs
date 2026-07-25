"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import type {
  AquaNavigationSection,
  AquaShellDensity,
} from "@/design-system"

import AquaSidebar from "./AquaSidebar"
import AquaTopbar from "./AquaTopbar"

type AquaDashboardShellProps = {
  children: React.ReactNode
  companyName: string
  userEmail: string
  userRole: string
  sections: AquaNavigationSection[]
  density?: AquaShellDensity
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",")

export default function AquaDashboardShell({
  children,
  companyName,
  userEmail,
  userRole,
  sections,
  density = "comfortable",
}: AquaDashboardShellProps) {
  const pathname = usePathname()
  const [navigationOpen, setNavigationOpen] = useState(false)
  const showcaseMode = pathname === "/dashboard/design-system"
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!navigationOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        setNavigationOpen(false)
        menuButtonRef.current?.focus()
        return
      }

      if (event.key !== "Tab" || !drawerRef.current) {
        return
      }

      const focusableElements = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((element) => !element.hasAttribute("disabled"))

      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [navigationOpen])

  function closeNavigation(options?: { restoreFocus?: boolean }) {
    const restoreFocus = options?.restoreFocus ?? false

    setNavigationOpen(false)

    if (restoreFocus) {
      window.requestAnimationFrame(() => menuButtonRef.current?.focus())
    }
  }

  return (
    <div
      className={`aqua-page aqua-shell ${
        showcaseMode ? "aqua-shell--showcase" : ""
      }`}
      dir="rtl"
      data-aqua-density={density}
    >
      <a className="aqua-skip-link" href="#aqua-main-content">
        الانتقال إلى المحتوى الرئيسي
      </a>

      <div className="aqua-grid" aria-hidden="true" />

      <div className="aqua-layer aqua-shell__layer">
        <AquaSidebar companyName={companyName} sections={sections} />

        <div className="aqua-main aqua-shell__main">
          <AquaTopbar
            userEmail={userEmail}
            userRole={userRole}
            navigationOpen={navigationOpen}
            onOpenNavigation={() => setNavigationOpen(true)}
            menuButtonRef={menuButtonRef}
          />

          <main id="aqua-main-content" className="aqua-shell__content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>

      <div
        id="aqua-mobile-navigation"
        className={`aqua-mobile-navigation ${
          navigationOpen ? "aqua-mobile-navigation--open" : ""
        }`}
        aria-hidden={!navigationOpen}
      >
        <button
          type="button"
          className="aqua-mobile-navigation__backdrop"
          aria-label="إغلاق قائمة التنقل"
          tabIndex={navigationOpen ? 0 : -1}
          onClick={() => closeNavigation({ restoreFocus: true })}
        />

        <div
          ref={drawerRef}
          className="aqua-mobile-navigation__drawer"
          role="dialog"
          aria-modal="true"
          aria-label="قائمة التنقل"
        >
          <AquaSidebar
            companyName={companyName}
            sections={sections}
            mode="drawer"
            onNavigate={() => closeNavigation()}
            onClose={() => closeNavigation({ restoreFocus: true })}
            closeButtonRef={closeButtonRef}
          />
        </div>
      </div>
    </div>
  )
}
