"use client"

import type { RefObject } from "react"
import { Menu } from "lucide-react"

import { AquaButton } from "@/components/aqua"
import LogoutButton from "@/components/auth/LogoutButton"

import AquaPageTitle from "./AquaPageTitle"

type AquaTopbarProps = {
  userEmail: string
  userRole: string
  navigationOpen: boolean
  onOpenNavigation: () => void
  menuButtonRef?: RefObject<HTMLButtonElement | null>
}

export default function AquaTopbar({
  userEmail,
  userRole,
  navigationOpen,
  onOpenNavigation,
  menuButtonRef,
}: AquaTopbarProps) {
  return (
    <header className="aqua-topbar">
      <div className="aqua-topbar__inner">
        <div className="aqua-topbar__heading-group">
          <AquaButton
            ref={menuButtonRef}
            type="button"
            variant="ghost"
            size="sm"
            className="aqua-shell-icon-button aqua-topbar__menu-button"
            aria-label="فتح قائمة التنقل"
            aria-haspopup="dialog"
            aria-expanded={navigationOpen}
            aria-controls="aqua-mobile-navigation"
            onClick={onOpenNavigation}
            leadingIcon={<Menu />}
          >
            <span className="visually-hidden">فتح قائمة التنقل</span>
          </AquaButton>

          <AquaPageTitle />
        </div>

        <div className="aqua-topbar__actions">
          <div className="aqua-topbar__identity" dir="ltr">
            <div className="aqua-topbar__email">{userEmail}</div>
            <div className="aqua-topbar__role">{userRole}</div>
          </div>

          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
