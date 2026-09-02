'use client';

/**
 * A researcher's knowledge-graph proposals, on their profile.
 *
 * @remarks
 * The profile listed a "Proposals" section and rendered "Graph proposals are
 * not yet available on profile pages" inside it — a placeholder that shipped.
 * `pub.chive.governance.listProposals` already accepts `proposedBy`, so the
 * data was there the whole time.
 *
 * A proposal is a request to add or change a node in the shared graph, so what
 * matters on a profile is what was proposed, whether the community accepted it,
 * and how the vote is going while it is open.
 *
 * @packageDocumentation
 */

import { useQuery } from '@tanstack/react-query';
import { GitPullRequest } from 'lucide-react';

import { api } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Props for {@link AuthorProposals}.
 *
 * @public
 */
export interface AuthorProposalsProps {
  /** The researcher's DID */
  did: string;
  /** Additional class names */
  className?: string;
}

/**
 * Badge styling per proposal status.
 */
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  expired: 'outline',
};

/**
 * Lists the graph proposals a researcher has made.
 *
 * @param props - Component props
 * @returns The proposal list, a loading state, or an empty state
 *
 * @public
 */
export function AuthorProposals({ did, className }: AuthorProposalsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['author', 'proposals', did],
    queryFn: async () => {
      const response = await api.pub.chive.governance.listProposals({ proposedBy: did, limit: 50 });
      return response.data;
    },
    enabled: !!did,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center',
          className
        )}
      >
        <p className="text-destructive">Failed to load proposals</p>
      </div>
    );
  }

  const proposals = data?.proposals ?? [];

  if (proposals.length === 0) {
    return (
      <div className={cn('rounded-lg border-2 border-dashed p-12 text-center', className)}>
        <GitPullRequest className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 text-base font-semibold">No proposals yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Proposals to add or change entries in the knowledge graph will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className={cn('space-y-3', className)}>
      {proposals.map((proposal) => {
        const label = proposal.label ?? proposal.changes?.label ?? 'Untitled proposal';
        const votes = proposal.votes;
        const total = votes.approve + votes.reject + votes.abstain;

        return (
          <li key={proposal.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{label}</p>
                <p className="text-sm text-muted-foreground">
                  {[proposal.type, proposal.changes?.subkind].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[proposal.status] ?? 'outline'} className="shrink-0">
                {proposal.status}
              </Badge>
            </div>

            {proposal.rationale && (
              <p className="mt-2 text-sm text-muted-foreground">{proposal.rationale}</p>
            )}

            {/* The vote only tells a reader anything while it is being decided;
                on a settled proposal the status already says how it ended. */}
            {proposal.status === 'pending' && total > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {votes.approve} approve · {votes.reject} reject
                {votes.abstain > 0 && ` · ${String(votes.abstain)} abstain`}
                {proposal.consensus.consensusReached && ' · consensus reached'}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
