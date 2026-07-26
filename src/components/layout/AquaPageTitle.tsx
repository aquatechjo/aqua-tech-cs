"use client"

import { usePathname } from "next/navigation"

import { resolveAquaRoute } from "./aqua-route-registry"

export default function AquaPageTitle() {
  const pathname = usePathname()
  const page = resolveAquaRoute(pathname)

  return (
    <div className="aqua-page-heading">
      <div className="aqua-page-heading__content">
        <h1 className="aqua-page-heading__title">{page.title}</h1>
      </div>
    </div>
  )
}
