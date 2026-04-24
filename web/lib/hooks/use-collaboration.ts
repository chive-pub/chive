/**
 * React hooks for collaboration invites and acceptances.
 *
 * @remarks
 * Backed by `pub.chive.collaboration.*` records. These hooks wrap:
 *
 * - {@link createInvite} / {@link deleteInvite}: owner-side mutations
 * - {@link createInviteAcceptance} / {@link deleteInviteAcceptance}: invitee-side
 * - {@link useListInvites}: invitee inbox / inviter dashboard
 * - {@link useListCollaborators}: current active collaborators on a subject
 *
 * Collaboration is generic over any Chive-authored subject record
 * (collections, eprints, reviews, ...). v1 consumers are collections; UI
 * for other subject types is additive.
 *
 * @packageDocumentation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import {
  createInviteRecord,
  deleteInviteRecord,
  createInviteAcceptance,
  deleteInviteAcceptance,
  loadEdgeSyncLookup,
  updateCosmikCollection,
} from '@/lib/atproto/record-creator';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import { APIError } from '@/lib/errors';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ context: { component: 'use-collaboration' } });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Invite view as returned by the API.
 *
 * @public
 */
export interface CollaborationInviteView {
  uri: string;
  inviter: string;
  invitee: string;
  subjectUri: string;
  subjectCollection?: string;
  role?: string;
  message?: string;
  state: 'pending' | 'accepted' | 'rejected' | 'expired';
  acceptanceUri?: string;
  createdAt: string;
  expiresAt?: string;
  acceptedAt?: string;
}

/**
 * Active collaborator view as returned by the API.
 *
 * @public
 */
export interface CollaboratorView {
  did: string;
  inviteUri: string;
  acceptanceUri: string;
  role?: string;
  acceptedAt: string;
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const collaborationKeys = {
  all: ['collaboration'] as const,
  invites: (filters: Record<string, unknown>) =>
    [...collaborationKeys.all, 'invites', filters] as const,
  collaborators: (subjectUri: string) =>
    [...collaborationKeys.all, 'collaborators', subjectUri] as const,
};

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Lists collaboration invites matching the given filters.
 *
 * @public
 */
export function useListInvites(
  filters: {
    invitee?: string;
    inviter?: string;
    subjectUri?: string;
    subjectCollection?: string;
    state?: 'pending' | 'accepted' | 'rejected' | 'expired' | 'all';
  },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: collaborationKeys.invites(filters),
    queryFn: async (): Promise<{ invites: CollaborationInviteView[] }> => {
      const response = await api.pub.chive.collaboration.listInvites(filters);
      return response.data as unknown as { invites: CollaborationInviteView[] };
    },
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

/**
 * Lists active collaborators on a subject record.
 *
 * @public
 */
export function useListCollaborators(subjectUri: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: collaborationKeys.collaborators(subjectUri),
    queryFn: async (): Promise<{ collaborators: CollaboratorView[] }> => {
      const response = await api.pub.chive.collaboration.listCollaborators({
        subjectUri,
      });
      return response.data as unknown as { collaborators: CollaboratorView[] };
    },
    enabled: !!subjectUri && (options?.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Syncs the active collaborator DID list to the Semble mirror's
 * `collaborators[]` field, if the collection has a Cosmik mirror.
 * No-op when the collection is not mirrored.
 */
async function syncCosmikCollaborators(
  agent: ReturnType<typeof getCurrentAgent>,
  subjectUri: string,
  collaboratorDids: string[]
): Promise<void> {
  if (!agent) return;
  try {
    const lookup = await loadEdgeSyncLookup(agent, subjectUri);
    if (!lookup) return; // not mirrored
    const cosmikCollectionUri = (lookup.node as Record<string, unknown>).metadata
      ? ((lookup.node as Record<string, unknown>).metadata as Record<string, unknown>)
          .cosmikCollectionUri
      : undefined;
    if (typeof cosmikCollectionUri !== 'string') return;
    await updateCosmikCollection(agent, cosmikCollectionUri, {
      collaborators: collaboratorDids,
    });
    logger.debug('Synced collaborators to Cosmik mirror', {
      subjectUri,
      cosmikCollectionUri,
      count: collaboratorDids.length,
    });
  } catch (err) {
    logger.warn('Failed to sync collaborators to Cosmik mirror', {
      subjectUri,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Mutation hook for creating a collaboration invite.
 *
 * @public
 */
export function useCreateInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      subjectUri: string;
      subjectCid: string;
      invitee: string;
      role?: string;
      message?: string;
      expiresAt?: string;
    }): Promise<{ inviteUri: string; inviteCid: string }> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createInvite');
      }
      const result = await createInviteRecord(agent, input);

      // Sync the updated collaborator list to the Cosmik mirror (best-effort).
      // The invite itself doesn't add a collaborator, but we sync the full list
      // to keep the mirror current after any invite/accept/revoke cycle.
      try {
        const collabs = await api.pub.chive.collaboration.listCollaborators({
          subjectUri: input.subjectUri,
        });
        const dids = (collabs.data.collaborators ?? []).map((c: { did: string }) => c.did);
        await syncCosmikCollaborators(agent, input.subjectUri, dids);
      } catch {
        // best-effort
      }

      return { inviteUri: result.uri, inviteCid: result.cid };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: collaborationKeys.all });
      queryClient.invalidateQueries({
        queryKey: collaborationKeys.collaborators(variables.subjectUri),
      });
    },
  });
}

/**
 * Mutation hook for revoking (deleting) an invite.
 *
 * @public
 */
export function useRevokeInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { inviteUri: string; subjectUri: string }): Promise<void> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'revokeInvite');
      }
      await deleteInviteRecord(agent, input.inviteUri);

      // Sync the updated collaborator list to the Cosmik mirror (best-effort)
      try {
        const collabs = await api.pub.chive.collaboration.listCollaborators({
          subjectUri: input.subjectUri,
        });
        const dids = (collabs.data.collaborators ?? []).map((c: { did: string }) => c.did);
        await syncCosmikCollaborators(agent, input.subjectUri, dids);
      } catch {
        // best-effort
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: collaborationKeys.all });
      queryClient.invalidateQueries({
        queryKey: collaborationKeys.collaborators(variables.subjectUri),
      });
    },
  });
}

/**
 * Mutation hook for accepting an invite.
 *
 * @public
 */
export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      inviteUri: string;
      inviteCid: string;
      subjectUri: string;
      subjectCid: string;
    }): Promise<{ acceptanceUri: string; acceptanceCid: string }> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'acceptInvite');
      }
      const result = await createInviteAcceptance(agent, input);
      return { acceptanceUri: result.uri, acceptanceCid: result.cid };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collaborationKeys.all });
    },
  });
}

/**
 * Mutation hook for withdrawing an acceptance (leaving a collaboration).
 *
 * @public
 */
export function useWithdrawAcceptance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { acceptanceUri: string }): Promise<void> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'withdrawAcceptance');
      }
      try {
        await deleteInviteAcceptance(agent, input.acceptanceUri);
      } catch (err) {
        logger.warn('Withdraw acceptance failed', {
          acceptanceUri: input.acceptanceUri,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collaborationKeys.all });
    },
  });
}
