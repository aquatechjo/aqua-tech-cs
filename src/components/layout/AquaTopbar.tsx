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
  const roleLabel =
    ({
      OWNER: "مالك النظام",
      ADMIN: "مدير النظام",
      MANAGER: "مدير",
      EMPLOYEE: "موظف",
    } as Record<string, string>)[userRole] ?? userRole
  const identityInitial = roleLabel.trim().charAt(0) || "م"

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
          <div
            className="aqua-topbar__identity"
            title={`الحساب: ${userEmail}`}
          >
            <span className="aqua-topbar__avatar" aria-hidden="true">
              {identityInitial}
            </span>
            <span className="aqua-topbar__identity-copy">
              <span className="aqua-topbar__account-label">{roleLabel}</span>
              <span className="aqua-topbar__email" dir="ltr">
                {userEmail}
              </span>
            </span>
          </div>

          <div className="aqua-topbar__logout">
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  )
}
