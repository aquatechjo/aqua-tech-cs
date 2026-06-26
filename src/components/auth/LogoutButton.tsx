"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

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
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="btn aqua-btn-ghost px-4 py-2"
    >
      {loading ? "جاري الخروج..." : "تسجيل الخروج"}
    </button>
  )
}