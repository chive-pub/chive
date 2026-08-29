import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { DataLinkView } from '@/lib/api/generated/types/pub/chive/eprint/listDataLinks';

/**
 * Query key factory for Layers data link queries.
 */
export const dataLinkKeys = {
  all: ['data-links'] as const,
  forEprint: (eprintUri: string) => [...dataLinkKeys.all, eprintUri] as const,
};

/**
 * Where the answer came from.
 *
 * @remarks
 * `unavailable` and an empty list are different facts. "This paper has no
 * linked datasets" is worth showing nothing for; "we could not ask Layers" is
 * worth not implying the first.
 */
export type DataLinkSource = 'layers' | 'cache' | 'unavailable';

/**
 * Layers datasets linked to an eprint.
 *
 * @remarks
 * Chive does not index `pub.layers.eprint.dataLink`; the Layers AppView is
 * authoritative for those records and Chive federates the read. The endpoint
 * answers `unavailable` rather than failing when Layers cannot be reached, so
 * this hook has no error state worth surfacing — the panel simply has nothing
 * to show, which is also true when a paper genuinely has no datasets.
 *
 * @param eprintUri - AT-URI of the eprint
 * @returns The links, whether they are still loading, and where they came from
 *
 * @public
 */
export function useDataLinks(eprintUri: string | undefined): {
  dataLinks: DataLinkView[];
  isLoading: boolean;
  source: DataLinkSource | undefined;
} {
  const query = useQuery({
    queryKey: dataLinkKeys.forEprint(eprintUri ?? ''),
    enabled: !!eprintUri,
    queryFn: async () => {
      const response = await api.pub.chive.eprint.listDataLinks({ eprintUri: eprintUri as string });
      return response.data;
    },
    // The server already caches this for five minutes; asking again sooner
    // would only move the same answer across the network.
    staleTime: 5 * 60 * 1000,
    // A federated read that failed is not worth retrying on the page: the
    // server has already given up on it once, quickly and deliberately.
    retry: false,
  });

  return {
    dataLinks: query.data?.dataLinks ?? [],
    isLoading: query.isLoading,
    source: query.data?.source as DataLinkSource | undefined,
  };
}
