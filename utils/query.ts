import type { QueryClient } from '@tanstack/react-query';

/**
 * Custom refresh handler for TanStack useInfiniteQuery.
 * Instead of refetching all pages loaded so far, it trims the query cache to just the first page
 * and then triggers refetch. This dramatically reduces unnecessary API calls and avoids
 * "refetching multiple pages in parallel" on pull-to-refresh.
 *
 * @param queryClient The active QueryClient instance
 * @param queryKey The query key of the infinite query
 * @param refetch The refetch function returned from useInfiniteQuery
 */
export async function refreshInfiniteQuery(
  queryClient: QueryClient,
  queryKey: any[],
  refetch: () => Promise<any>,
) {
  queryClient.setQueryData(queryKey, (oldData: any) => {
    if (!oldData) return oldData;
    return {
      pages: oldData.pages.slice(0, 1),
      pageParams: oldData.pageParams.slice(0, 1),
    };
  });
  return refetch();
}
