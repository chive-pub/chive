import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser, useAgent } from '@/lib/auth';
import { createMuteRecord, deleteMuteRecord } from '@/lib/atproto/record-creator';
import type { MuteRecord } from '@/lib/atproto/record-creator';

const MUTED_AUTHORS_STORAGE_KEY = 'chive:mutedAuthors';

/**
 * Query key factory for muted authors queries.
 */
export const muteKeys = {
  all: ['muted-authors'] as const,
  list: (authenticated: boolean) => [...muteKeys.all, { authenticated }] as const,
};

/**
 * Data returned by the muted authors query.
 */
interface MutedAuthorsData {
  /** Map of DID to record URI for deletion */
  records: Map<string, string>;
  /** Set of muted DIDs for fast lookup */
  dids: Set<string>;
}

function getStoredMutedDids(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(MUTED_AUTHORS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveStoredMutedDids(dids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MUTED_AUTHORS_STORAGE_KEY, JSON.stringify(dids));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook that provides the set of muted author DIDs.
 *
 * @remarks
 * For authenticated users, reads mute records from the user's PDS.
 * Falls back to localStorage for unauthenticated users.
 */
export function useMutedAuthors() {
  const user = useCurrentUser();
  const agent = useAgent();
  const isAuthenticated = !!user?.did;

  const query = useQuery({
    queryKey: muteKeys.list(isAuthenticated),
    queryFn: async (): Promise<MutedAuthorsData> => {
      if (isAuthenticated && agent) {
        try {
          // TODO: Only fetches the first 100 mute records. Users with 100+
          // mutes would need cursor-based pagination across multiple requests.
          const response = await agent.com.atproto.repo.listRecords({
            repo: agent.did!,
            collection: 'pub.chive.actor.mute',
            limit: 100,
          });

          const records = new Map<string, string>();
          const dids = new Set<string>();

          for (const record of response.data.records) {
            const value = record.value as MuteRecord;
            records.set(value.subjectDid, record.uri);
            dids.add(value.subjectDid);
          }

          // Sync to localStorage as backup
          saveStoredMutedDids(Array.from(dids));

          return { records, dids };
        } catch {
          // Fall back to localStorage
        }
      }

      const storedDids = getStoredMutedDids();
      return {
        records: new Map(),
        dids: new Set(storedDids),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const mutedDids = query.data?.dids ?? new Set<string>();

  return {
    mutedDids,
    isLoading: query.isLoading,
  };
}

/**
 * Returns whether a given author DID is muted.
 */
export function useIsAuthorMuted(did: string): boolean {
  const { mutedDids } = useMutedAuthors();
  return mutedDids.has(did);
}

/**
 * Mutation hook for muting an author.
 */
export function useMuteAuthor() {
  const queryClient = useQueryClient();
  const agent = useAgent();
  const user = useCurrentUser();
  const isAuthenticated = !!user?.did;

  return useMutation({
    mutationFn: async (subjectDid: string) => {
      // Save to localStorage
      const stored = getStoredMutedDids();
      if (!stored.includes(subjectDid)) {
        saveStoredMutedDids([...stored, subjectDid]);
      }

      // Save to PDS for authenticated users
      if (agent?.did) {
        await createMuteRecord(agent, subjectDid);
      }
    },
    onMutate: async (subjectDid: string) => {
      await queryClient.cancelQueries({ queryKey: muteKeys.list(isAuthenticated) });

      const previous = queryClient.getQueryData<MutedAuthorsData>(muteKeys.list(isAuthenticated));

      // Optimistic update
      if (previous) {
        const newDids = new Set(previous.dids);
        newDids.add(subjectDid);
        queryClient.setQueryData(muteKeys.list(isAuthenticated), {
          records: previous.records,
          dids: newDids,
        });
      }

      return { previous };
    },
    onError: (_err, _did, context) => {
      if (context?.previous) {
        queryClient.setQueryData(muteKeys.list(isAuthenticated), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: muteKeys.all });
    },
  });
}

/**
 * Mutation hook for unmuting an author.
 */
export function useUnmuteAuthor() {
  const queryClient = useQueryClient();
  const agent = useAgent();
  const user = useCurrentUser();
  const isAuthenticated = !!user?.did;

  return useMutation({
    mutationFn: async (subjectDid: string) => {
      // Remove from localStorage
      const stored = getStoredMutedDids();
      saveStoredMutedDids(stored.filter((d) => d !== subjectDid));

      // Remove from PDS for authenticated users
      if (agent?.did) {
        await deleteMuteRecord(agent, subjectDid);
      }
    },
    onMutate: async (subjectDid: string) => {
      await queryClient.cancelQueries({ queryKey: muteKeys.list(isAuthenticated) });

      const previous = queryClient.getQueryData<MutedAuthorsData>(muteKeys.list(isAuthenticated));

      // Optimistic update
      if (previous) {
        const newDids = new Set(previous.dids);
        newDids.delete(subjectDid);
        const newRecords = new Map(previous.records);
        newRecords.delete(subjectDid);
        queryClient.setQueryData(muteKeys.list(isAuthenticated), {
          records: newRecords,
          dids: newDids,
        });
      }

      return { previous };
    },
    onError: (_err, _did, context) => {
      if (context?.previous) {
        queryClient.setQueryData(muteKeys.list(isAuthenticated), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: muteKeys.all });
    },
  });
}

/**
 * Filters items by removing those with any muted author.
 *
 * @param items - Array of items to filter
 * @param mutedDids - Set of muted author DIDs
 * @param getAuthorDids - Function to extract author DIDs from an item
 * @returns Filtered array with muted content removed
 */
export function filterMutedContent<T>(
  items: T[],
  mutedDids: Set<string>,
  getAuthorDids: (item: T) => string[]
): T[] {
  if (mutedDids.size === 0) return items;
  return items.filter((item) => {
    const authorDids = getAuthorDids(item);
    return !authorDids.some((did) => mutedDids.has(did));
  });
}
