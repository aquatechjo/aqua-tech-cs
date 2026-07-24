"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AquaButton } from "@/components/aqua"

export default function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      })

      router.push("/login")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AquaButton
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      loading={loading}
      loadingLabel="جارٍ تسجيل الخروج"
    >
      خروج
    </AquaButton>
  )
}