/**
 * Reading the citation network.
 *
 * @remarks
 * One request for the whole graph rather than one per paper. The network is
 * small -- it holds only citations where Chive indexes both ends -- and having
 * all of it in hand is what lets a reader zoom out from the paper they arrived
 * on and click into a neighbourhood without waiting for another fetch.
 *
 * @packageDocumentation
 */

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { CitedPaper } from '@/lib/citations/paper-label';
import type { NetworkEdge } from '@/lib/citations/network-model';

/** The network as the view needs it. */
export interface CitationNetwork {
  /** Every paper at either end of a citation, once each. */
  readonly papers: readonly CitedPaper[];
  /** Every directed citation. */
  readonly citations: readonly NetworkEdge[];
  /** The requested paper, present only when it is in the network. */
  readonly focusUri?: string;
  /** Whether the network was cut short at the limit. */
  readonly truncated: boolean;
  /** How many citations the whole network holds. */
  readonly totalCitations: number;
}

/** Query key factory. */
export const citationNetworkKeys = {
  all: ['citation-network'] as const,
  forEprint: (uri: string) => [...citationNetworkKeys.all, uri] as const,
};

/**
 * Fetches the citation network around one paper.
 *
 * @param eprintUri - The paper the reader arrived on
 * @returns The network, and whether it is still loading
 *
 * @public
 */
export function useCitationNetwork(eprintUri: string): {
  network: CitationNetwork | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const query = useQuery({
    queryKey: citationNetworkKeys.forEprint(eprintUri),
    enabled: Boolean(eprintUri),
    queryFn: async (): Promise<CitationNetwork> => {
      const response = await api.pub.chive.discovery.getCitationNetwork({ uri: eprintUri });
      const data = response.data;
      return {
        papers: data.papers ?? [],
        citations: data.citations,
        ...(data.focusUri !== undefined ? { focusUri: data.focusUri } : {}),
        truncated: data.truncated,
        totalCitations: data.totalCitations ?? data.citations.length,
      };
    },
    // The graph moves when the indexer matches a new reference, which is not
    // often. Refetching it while a reader is exploring would relayout the
    // network under them.
    staleTime: 5 * 60 * 1000,
  });

  return {
    network: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
