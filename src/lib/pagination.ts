export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Reads `page`/`limit` from query params and returns Prisma-ready
 * `skip`/`take`, clamped to `maxLimit` even if the caller asks for more.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  options?: { defaultLimit?: number; maxLimit?: number },
): PaginationParams {
  const defaultLimit = options?.defaultLimit ?? DEFAULT_PAGE_SIZE;
  const maxLimit = options?.maxLimit ?? MAX_PAGE_SIZE;

  const rawPage = Number(searchParams.get('page'));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawLimit = Number(searchParams.get('limit'));
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), maxLimit)
      : defaultLimit;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function buildPaginationMeta(total: number, params: PaginationParams): PaginationMeta {
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}
