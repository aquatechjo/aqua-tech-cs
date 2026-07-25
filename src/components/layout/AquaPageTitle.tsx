"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { resolveAquaRoute } from "./aqua-route-registry"

export default function AquaPageTitle() {
  const pathname = usePathname()
  const page = resolveAquaRoute(pathname)

  return (
    <div className="aqua-page-heading">
      <nav className="aqua-breadcrumbs" aria-label="مسار الصفحة">
        <ol className="aqua-breadcrumbs__list">
          {pathname === "/dashboard" ? (
            <li className="aqua-breadcrumbs__item" aria-current="page">
              لوحة التحكم
            </li>
          ) : (
            <>
              <li className="aqua-breadcrumbs__item">
                <Link href="/dashboard" className="aqua-breadcrumbs__link">
                  لوحة التحكم
                </Link>
              </li>
              <li className="aqua-breadcrumbs__separator" aria-hidden="true">
                /
              </li>

              {page.isNested ? (
                <>
                  <li className="aqua-breadcrumbs__item">
                    <Link href={page.path} className="aqua-breadcrumbs__link">
                      {page.title}
                    </Link>
                  </li>
                  <li
                    className="aqua-breadcrumbs__separator"
                    aria-hidden="true"
                  >
                    /
                  </li>
                  <li className="aqua-breadcrumbs__item" aria-current="page">
                    التفاصيل
                  </li>
                </>
              ) : (
                <li className="aqua-breadcrumbs__item" aria-current="page">
                  {page.title}
                </li>
              )}
            </>
          )}
        </ol>
      </nav>

      <div className="aqua-page-heading__eyebrow" dir="ltr">
        Aqua.Tech OS
      </div>
      <h1 className="aqua-page-heading__title">{page.title}</h1>
      <p className="aqua-page-heading__subtitle">{page.subtitle}</p>
    </div>
  )
}
