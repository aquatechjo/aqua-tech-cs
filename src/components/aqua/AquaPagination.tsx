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

export default function AquaPagination({
  basePath,
  currentPage,
  totalPages,
}: {
  basePath: string
  currentPage: number
  totalPages: number
}) {
  if (totalPages <= 1) return null

  const pages = getPages(currentPage, totalPages)

  function pageHref(page: number) {
    return `${basePath}?page=${page}`
  }

  return (
    <nav aria-label="Pagination">
      <ul className="pagination aqua-pagination justify-content-center justify-content-md-end">
        <li className={`page-item ${currentPage <= 1 ? "disabled" : ""}`}>
          {currentPage <= 1 ? (
            <span className="page-link">السابق</span>
          ) : (
            <Link className="page-link" href={pageHref(currentPage - 1)}>
              السابق
            </Link>
          )}
        </li>

        {pages.map((page, index) =>
          page === "..." ? (
            <li key={`dots-${index}`} className="page-item disabled">
              <span className="page-link">...</span>
            </li>
          ) : (
            <li
              key={page}
              className={`page-item ${page === currentPage ? "active" : ""}`}
            >
              <Link className="page-link" href={pageHref(page)}>
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
            <span className="page-link">التالي</span>
          ) : (
            <Link className="page-link" href={pageHref(currentPage + 1)}>
              التالي
            </Link>
          )}
        </li>
      </ul>
    </nav>
  )
}