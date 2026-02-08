/**
 * Hooks for eprint mutations (delete, update) and changelogs.
 *
 * @remarks
 * Provides TanStack Query mutations for eprint lifecycle operations.
 * These mutations call the authorization endpoints and return the
 * information needed for the frontend to make PDS calls.
 *
 * Also provides query hooks for fetching changelog data.
 *
 * @packageDocumentation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, authApi } from '@/lib/api/client';
import type {
  Main as AuthorContribution,
  Affiliation as AuthorAffiliation,
  Contribution,
} from '@/lib/api/generated/types/pub/chive/eprint/authorContribution';
import type { ChangelogSection } from '@/lib/api/generated/types/pub/chive/eprint/changelog';
import type { OutputSchema as DeleteOutput } from '@/lib/api/generated/types/pub/chive/eprint/deleteSubmission';
import type { OutputSchema as GetChangelogOutput } from '@/lib/api/generated/types/pub/chive/eprint/getChangelog';
import type { ChangelogView } from '@/lib/api/generated/types/pub/chive/eprint/listChangelogs';
import type {
  OutputSchema as UpdateOutput,
  ChangelogInput,
} from '@/lib/api/generated/types/pub/chive/eprint/updateSubmission';
import type { SemanticVersion } from '@/lib/api/generated/types/pub/chive/eprint/submission';
import { APIError } from '@/lib/errors';

import { eprintKeys } from './use-eprint';

// Re-export generated types for consumers
export type {
  AuthorContribution,
  AuthorAffiliation,
  Contribution,
  ChangelogInput,
  ChangelogSection,
};

/**
 * Session for paper account authentication.
 *
 * @public
 */
export interface PaperSession {
  /** Paper account DID */
  did: string;
  /** Access token for the paper account */
  accessToken: string;
}

/**
 * Version bump type for semantic versioning.
 *
 * @public
 */
export type VersionBumpType = 'major' | 'minor' | 'patch';

/**
 * Parameters for delete eprint mutation.
 */
interface DeleteEprintParams {
  /** AT-URI of the eprint to delete */
  uri: string;
}

/**
 * Parameters for update eprint mutation.
 *
 * @remarks
 * Uses generated types from the lexicon schema for authors and changelog.
 */
interface UpdateEprintParams {
  /** AT-URI of the eprint to update */
  uri: string;
  /** Type of version increment */
  versionBump: VersionBumpType;
  /** Updated title (optional) */
  title?: string;
  /** Updated keywords (optional) */
  keywords?: string[];
  /** Updated field node URIs (optional) */
  fieldUris?: string[];
  /** Updated authors (optional) */
  authors?: AuthorContribution[];
  /** Structured changelog data (optional) */
  changelog?: ChangelogInput;
}

/**
 * Mutation hook for deleting eprints.
 *
 * @remarks
 * Validates authorization via the backend. On success, invalidates
 * relevant queries. The actual PDS deletion should be performed
 * by the frontend using the ATProto client.
 *
 * @returns TanStack Query mutation object with mutate, isPending, and error states
 *
 * @example
 * ```tsx
 * const { mutate: deleteEprint, isPending } = useDeleteEprint();
 *
 * const handleDelete = async () => {
 *   try {
 *     await deleteEprint({ uri: eprint.uri });
 *     // Now make the actual PDS call
 *     await atprotoAgent.deleteRecord(eprint.uri);
 *     toast.success('Eprint deleted');
 *   } catch (error) {
 *     toast.error('Failed to delete eprint');
 *   }
 * };
 * ```
 */
export function useDeleteEprint() {
  const queryClient = useQueryClient();

  return useMutation<DeleteOutput, APIError, DeleteEprintParams>({
    mutationFn: async ({ uri }) => {
      try {
        const response = await authApi.pub.chive.eprint.deleteSubmission({ uri });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to authorize deletion',
          undefined,
          'pub.chive.eprint.deleteSubmission'
        );
      }
    },
    onSuccess: (_, { uri }) => {
      // Invalidate the specific eprint query
      queryClient.invalidateQueries({ queryKey: eprintKeys.detail(uri) });
      // Invalidate all eprint list queries
      queryClient.invalidateQueries({ queryKey: eprintKeys.all });
    },
  });
}

/**
 * Mutation hook for updating eprints.
 *
 * @remarks
 * Validates authorization and computes the new semantic version.
 * On success, invalidates relevant queries. The actual PDS update
 * should be performed by the frontend using the ATProto client.
 *
 * @returns TanStack Query mutation object with mutate, isPending, and error states
 *
 * @example
 * ```tsx
 * const { mutate: updateEprint, isPending } = useUpdateEprint();
 *
 * const handleUpdate = async () => {
 *   try {
 *     const result = await updateEprint({
 *       uri: eprint.uri,
 *       versionBump: 'minor',
 *       title: 'Updated Title',
 *     });
 *     // Use result.version for the PDS call
 *     await atprotoAgent.putRecord(eprint.uri, { ...record, version: result.version });
 *     toast.success('Eprint updated');
 *   } catch (error) {
 *     toast.error('Failed to update eprint');
 *   }
 * };
 * ```
 */
export function useUpdateEprint() {
  const queryClient = useQueryClient();

  return useMutation<UpdateOutput, APIError, UpdateEprintParams>({
    mutationFn: async ({ uri, versionBump, fieldUris, authors, changelog }) => {
      try {
        const response = await authApi.pub.chive.eprint.updateSubmission({
          uri,
          versionBump,
          fieldUris,
          // Authors already match the generated AuthorContribution type
          authors,
          // Changelog already matches the generated ChangelogInput type
          changelog,
        });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to authorize update',
          undefined,
          'pub.chive.eprint.updateSubmission'
        );
      }
    },
    onSuccess: (_, { uri }) => {
      // Invalidate the specific eprint query
      queryClient.invalidateQueries({ queryKey: eprintKeys.detail(uri) });
      // Invalidate all eprint list queries
      queryClient.invalidateQueries({ queryKey: eprintKeys.all });
    },
  });
}

/**
 * Eprint data for permission checking.
 */
interface EprintData {
  /** DID of the human who submitted the eprint */
  submittedBy: string;
  /** DID of the paper account (if paper-centric) */
  paperDid?: string;
}

/**
 * Permission check result.
 */
interface EprintPermissions {
  /** Whether the user can modify (edit/delete) the eprint */
  canModify: boolean;
  /** Whether paper authentication is required for modification */
  requiresPaperAuth: boolean;
  /** Reason why modification is not allowed (if applicable) */
  reason?: string;
}

/**
 * Determines if the current user can edit/delete an eprint.
 *
 * @param eprint - Eprint data with submittedBy and optional paperDid
 * @param userDid - Current user's DID (undefined if not authenticated)
 * @returns Permission object with canModify, requiresPaperAuth, and reason
 *
 * @remarks
 * For paper-centric eprints (paperDid is set), the user must authenticate
 * as the paper account to modify. For traditional eprints, only the
 * submitter can modify.
 *
 * @example
 * ```tsx
 * const { canModify, requiresPaperAuth, reason } = useEprintPermissions(eprint, userDid);
 *
 * if (!canModify) {
 *   return <span>You cannot edit this eprint: {reason}</span>;
 * }
 *
 * if (requiresPaperAuth) {
 *   return <PaperAuthPrompt paperDid={eprint.paperDid} />;
 * }
 *
 * return <EditButton />;
 * ```
 */
export function useEprintPermissions(
  eprint: EprintData | undefined,
  userDid: string | undefined
): EprintPermissions {
  if (!eprint || !userDid) {
    return { canModify: false, requiresPaperAuth: false, reason: 'Not authenticated' };
  }

  const isSubmitter = eprint.submittedBy === userDid;
  const isPaperOwner = eprint.paperDid === userDid;
  const isPaperCentric = !!eprint.paperDid;

  if (isPaperCentric) {
    // Paper-centric: can only modify if authenticated as paper account
    return {
      canModify: isSubmitter || isPaperOwner,
      requiresPaperAuth: isSubmitter && !isPaperOwner,
      reason:
        isSubmitter && !isPaperOwner
          ? 'Paper authentication required'
          : !isSubmitter && !isPaperOwner
            ? 'Not authorized'
            : undefined,
    };
  }

  // Traditional: submitter can modify
  return {
    canModify: isSubmitter,
    requiresPaperAuth: false,
    reason: !isSubmitter ? 'Not authorized' : undefined,
  };
}

/**
 * Formats a semantic version as a display string.
 *
 * @param version - semantic version object with major, minor, patch, and optional prerelease
 * @returns formatted version string (e.g., "1.2.3" or "1.0.0-draft")
 *
 * @example
 * ```typescript
 * formatVersion({ major: 1, minor: 2, patch: 3 }); // "1.2.3"
 * formatVersion({ major: 1, minor: 0, patch: 0, prerelease: 'draft' }); // "1.0.0-draft"
 * ```
 *
 * @public
 */
export function formatVersion(version: SemanticVersion | null | undefined): string {
  const major = version?.major ?? 0;
  const minor = version?.minor ?? 0;
  const patch = version?.patch ?? 0;
  const base = `${major}.${minor}.${patch}`;
  return version?.prerelease ? `${base}-${version.prerelease}` : base;
}

// =============================================================================
// CHANGELOG QUERY KEYS AND HOOKS
// =============================================================================

/**
 * Query key factory for changelog queries.
 *
 * @remarks
 * Follows TanStack Query best practices for cache key management.
 * Enables fine-grained cache invalidation for changelog data.
 *
 * @example
 * ```typescript
 * // Invalidate all changelog queries
 * queryClient.invalidateQueries({ queryKey: changelogKeys.all });
 *
 * // Invalidate changelogs for a specific eprint
 * queryClient.invalidateQueries({ queryKey: changelogKeys.list('at://did:plc:abc/...') });
 *
 * // Invalidate a specific changelog
 * queryClient.invalidateQueries({ queryKey: changelogKeys.detail('at://did:plc:abc/...') });
 * ```
 */
export const changelogKeys = {
  /** Base key for all changelog queries */
  all: ['changelogs'] as const,
  /** Key for changelog list queries */
  lists: () => [...changelogKeys.all, 'list'] as const,
  /** Key for changelogs of a specific eprint */
  list: (eprintUri: string) => [...changelogKeys.lists(), eprintUri] as const,
  /** Key for changelog detail queries */
  details: () => [...changelogKeys.all, 'detail'] as const,
  /** Key for a specific changelog detail query */
  detail: (uri: string) => [...changelogKeys.details(), uri] as const,
};

/**
 * Options for the useEprintChangelogs hook.
 */
interface UseEprintChangelogsOptions {
  /** Maximum number of changelogs to return per page */
  limit?: number;
  /** Pagination cursor for fetching subsequent pages */
  cursor?: string;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Response from the useEprintChangelogs hook.
 */
interface EprintChangelogsResponse {
  /** List of changelog entries, newest first */
  changelogs: ChangelogView[];
  /** Pagination cursor for next page (undefined if no more pages) */
  cursor?: string;
  /** Whether there are more changelogs to fetch */
  hasMore: boolean;
}

/**
 * Fetches paginated changelogs for an eprint.
 *
 * @remarks
 * Uses TanStack Query with a 5-minute stale time to balance freshness with
 * cache efficiency. Changelogs are immutable once created, so aggressive
 * caching is appropriate.
 *
 * @param eprintUri - AT Protocol URI of the eprint to fetch changelogs for
 * @param options - Query options including pagination parameters
 * @returns Query result with changelog list, loading state, and error
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, fetchNextPage, hasNextPage } = useEprintChangelogs(
 *   'at://did:plc:abc/pub.chive.eprint.submission/123',
 *   { limit: 10 }
 * );
 *
 * if (isLoading) return <ChangelogSkeleton />;
 * if (error) return <ChangelogError error={error} />;
 *
 * return (
 *   <ChangelogList
 *     changelogs={data?.changelogs ?? []}
 *     hasMore={data?.hasMore ?? false}
 *     onLoadMore={fetchNextPage}
 *   />
 * );
 * ```
 */
export function useEprintChangelogs(eprintUri: string, options: UseEprintChangelogsOptions = {}) {
  const { limit, cursor, enabled = true } = options;

  return useQuery<EprintChangelogsResponse, APIError>({
    queryKey: [...changelogKeys.list(eprintUri), { limit, cursor }],
    queryFn: async (): Promise<EprintChangelogsResponse> => {
      try {
        const response = await api.pub.chive.eprint.listChangelogs({
          eprintUri,
          limit,
          cursor,
        });
        const data = response.data;
        return {
          changelogs: data.changelogs,
          cursor: data.cursor,
          hasMore: !!data.cursor,
        };
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch changelogs',
          undefined,
          'pub.chive.eprint.listChangelogs'
        );
      }
    },
    enabled: !!eprintUri && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes; changelogs are immutable once created.
  });
}

/**
 * Options for the useChangelog hook.
 */
interface UseChangelogOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Fetches a single changelog by its AT Protocol URI.
 *
 * @remarks
 * Uses TanStack Query with a 5-minute stale time. Changelogs are immutable
 * records, so caching is highly effective.
 *
 * @param uri - AT Protocol URI of the changelog record
 * @param options - Query options
 * @returns Query result with changelog data, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: changelog, isLoading, error } = useChangelog(
 *   'at://did:plc:abc/pub.chive.eprint.changelog/123'
 * );
 *
 * if (isLoading) return <ChangelogSkeleton />;
 * if (error) return <ChangelogError error={error} />;
 *
 * return (
 *   <ChangelogDetail
 *     version={formatVersion(changelog.version)}
 *     summary={changelog.summary}
 *     sections={changelog.sections}
 *     createdAt={changelog.createdAt}
 *   />
 * );
 * ```
 */
export function useChangelog(uri: string, options: UseChangelogOptions = {}) {
  const { enabled = true } = options;

  return useQuery<GetChangelogOutput, APIError>({
    queryKey: changelogKeys.detail(uri),
    queryFn: async (): Promise<GetChangelogOutput> => {
      try {
        const response = await api.pub.chive.eprint.getChangelog({ uri });
        return response.data;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch changelog',
          undefined,
          'pub.chive.eprint.getChangelog'
        );
      }
    },
    enabled: !!uri && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes; changelogs are immutable.
  });
}
