export interface Pagination {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function paginationToSkipTake(p: Pagination): { skip: number; take: number } {
  const page = p.page > 0 ? p.page : 1;
  const pageSize = p.pageSize > 0 ? p.pageSize : 20;
  return { skip: (page - 1) * pageSize, take: pageSize };
}
