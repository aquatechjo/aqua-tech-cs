"use client"

import type { RefObject } from "react"
import { X } from "lucide-react"

import { AquaBadge, AquaButton, AquaMark } from "@/components/aqua"
import type { AquaNavigationSection } from "@/design-system"

import AquaSidebarNav from "./AquaSidebarNav"

type AquaSidebarProps = {
  companyName: string
  sections: AquaNavigationSection[]
  mode?: "desktop" | "drawer"
  onNavigate?: () => void
  onClose?: () => void
  closeButtonRef?: RefObject<HTMLButtonElement | null>
}

export default function AquaSidebar({
  companyName,
  sections,
  mode = "desktop",
  onNavigate,
  onClose,
  closeButtonRef,
}: AquaSidebarProps) {
  return (
    <aside
      className={`aqua-sidebar aqua-sidebar--${mode}`}
      aria-label={mode === "drawer" ? "قائمة التنقل" : undefined}
    >
      <div className="aqua-sidebar__header">
        <AquaMark size="md" />

        {mode === "drawer" && onClose ? (
          <AquaButton
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            size="sm"
            className="aqua-shell-icon-button"
            aria-label="إغلاق قائمة التنقل"
            leadingIcon={<X />}
            onClick={onClose}
          >
            <span className="visually-hidden">إغلاق قائمة التنقل</span>
          </AquaButton>
        ) : null}
      </div>

      <div className="aqua-sidebar__company">
        <AquaBadge size="sm">Internal OS</AquaBadge>
        <div className="aqua-sidebar__company-name">{companyName}</div>
        <div className="aqua-sidebar__company-meta" dir="ltr">
          Growth • Software • AI
        </div>
      </div>

      <div className="aqua-sidebar__navigation">
        <AquaSidebarNav sections={sections} onNavigate={onNavigate} />
      </div>

      <div className="aqua-sidebar__footer" dir="ltr">
        <div className="aqua-sidebar__stack-label">{"</>"} Aqua.Tech Stack</div>
        <div className="aqua-sidebar__stack-items" aria-label="تقنيات النظام">
          {['Next.js', 'AI', 'API', 'DB'].map((item) => (
            <span className="aqua-sidebar__stack-item" key={item}>
              {item}
            </span>
          ))}
        </div>
      </div>
    </aside>
  )
}
