"use client"

import type { RefObject } from "react"
import { Languages, Menu } from "lucide-react"

import { AquaButton, AquaLinkButton } from "@/components/aqua"
import LogoutButton from "@/components/auth/LogoutButton"

import AquaPageTitle from "./AquaPageTitle"

type AquaTopbarProps = {
  projectName: string
  language: string
  userEmail: string
  userRole: string
  navigationOpen: boolean
  onOpenNavigation: () => void
  menuButtonRef?: RefObject<HTMLButtonElement | null>
}

export default function AquaTopbar({
  projectName,
  language,
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
  const nextLanguageLabel = language.toLowerCase().startsWith("en")
    ? "AR"
    : "EN"

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

          <div className="aqua-topbar__page-context">
            <span className="aqua-topbar__project-name" dir="ltr">
              {projectName}
            </span>
            <span className="aqua-topbar__context-divider" aria-hidden="true" />
            <AquaPageTitle />
          </div>
        </div>

        <div className="aqua-topbar__actions">
          <AquaLinkButton
            href="/dashboard/settings"
            variant="ghost"
            size="sm"
            className="aqua-topbar__language"
            leadingIcon={<Languages />}
            aria-label={`إعداد لغة النظام — الانتقال إلى ${nextLanguageLabel}`}
            title="إعداد لغة النظام"
          >
            {nextLanguageLabel}
          </AquaLinkButton>

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
