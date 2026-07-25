import Link from "next/link"

function getPages(currentPage: number, totalPages: number) {
  const pages: (number | "...")[] = []

  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page++) {
      pages.push(page)
    }

    return pages
  }

  pages.push(1)

  if (currentPage > 4) {
    pages.push("...")
  }

  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  for (let page = start; page <= end; page++) {
    pages.push(page)
  }

  if (currentPage < totalPages - 3) {
    pages.push("...")
  }

  pages.push(totalPages)

  return pages
}

type AquaPaginationProps = {
  basePath: string
  currentPage: number
  totalPages: number
  queryParams?: Record<string, string | undefined | null>
  from?: number
  to?: number
  totalItems?: number
  label?: string
}

export default function AquaPagination({
  basePath,
  currentPage,
  totalPages,
  queryParams,
  from,
  to,
  totalItems,
  label = "التنقل بين الصفحات",
}: AquaPaginationProps) {
  if (totalPages <= 1) return null

  const pages = getPages(currentPage, totalPages)

  function pageHref(page: number) {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(queryParams ?? {})) {
      if (value && value.trim() !== "") {
        params.set(key, value)
      }
    }

    params.set("page", String(page))

    return `${basePath}?${params.toString()}`
  }

  const hasSummary =
    typeof from === "number" &&
    typeof to === "number" &&
    typeof totalItems === "number"

  return (
    <div className="aqua-pagination-shell">
      {hasSummary ? (
        <div className="aqua-pagination-summary" aria-live="polite">
          عرض {from}–{to} من أصل {totalItems}
        </div>
      ) : (
        <div className="aqua-pagination-summary" aria-live="polite">
          الصفحة {currentPage} من {totalPages}
        </div>
      )}

      <nav aria-label={label}>
        <ul className="pagination aqua-pagination">
          <li className={`page-item ${currentPage <= 1 ? "disabled" : ""}`}>
            {currentPage <= 1 ? (
              <span className="page-link" aria-disabled="true">
                السابق
              </span>
            ) : (
              <Link className="page-link" href={pageHref(currentPage - 1)}>
                السابق
              </Link>
            )}
          </li>

          {pages.map((page, index) =>
            page === "..." ? (
              <li key={`dots-${index}`} className="page-item disabled">
                <span className="page-link" aria-hidden="true">
                  …
                </span>
              </li>
            ) : (
              <li
                key={page}
                className={`page-item ${page === currentPage ? "active" : ""}`}
              >
                <Link
                  className="page-link"
                  href={pageHref(page)}
                  aria-current={page === currentPage ? "page" : undefined}
                  aria-label={`الصفحة ${page}`}
                >
                  {page}
                </Link>
              </li>
            )
          )}

          <li
            className={`page-item ${
              currentPage >= totalPages ? "disabled" : ""
            }`}
          >
            {currentPage >= totalPages ? (
              <span className="page-link" aria-disabled="true">
                التالي
              </span>
            ) : (
              <Link className="page-link" href={pageHref(currentPage + 1)}>
                التالي
              </Link>
            )}
          </li>
        </ul>
      </nav>
    </div>
  )
}

export type { AquaPaginationProps }
