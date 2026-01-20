'use client';

import Link from 'next/link';
import { Vote, ExternalLink, Clock, CheckCircle, XCircle, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProposals, STATUS_LABELS, TYPE_LABELS } from '@/lib/hooks/use-governance';
import { useCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { ProposalStatus } from '@/lib/api/schema';

/**
 * Status icon component.
 */
function StatusIcon({ status }: { status: ProposalStatus }) {
  switch (status) {
    case 'approved':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'rejected':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'expired':
      return <Timer className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Clock className="h-4 w-4 text-amber-500" />;
  }
}

/**
 * Status badge variant.
 */
function getStatusVariant(
  status: ProposalStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
      return 'default';
    case 'rejected':
      return 'destructive';
    case 'expired':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * User's proposals page.
 */
export default function MyProposalsPage() {
  const user = useCurrentUser();
  const { data, isLoading, error } = useProposals({ limit: 50 });

  // Filter to only show user's own proposals
  const myProposals = data?.proposals?.filter((p) => p.proposedBy === user?.did) ?? [];

  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Proposals</h1>
          <p className="text-muted-foreground">Sign in to view your proposals</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Proposals</h1>
          <p className="text-muted-foreground">Knowledge graph proposals you have submitted</p>
        </div>
        <Button asChild>
          <Link href="/governance/proposals/new">
            <Vote className="mr-2 h-4 w-4" />
            New Proposal
          </Link>
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border p-4 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/3 mb-2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Failed to load proposals. Please try again.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && myProposals.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <Vote className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No proposals yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Proposals you submit to the knowledge graph will appear here
          </p>
          <Button asChild className="mt-4">
            <Link href="/governance/proposals/new">Create your first proposal</Link>
          </Button>
        </div>
      )}

      {/* Proposals list */}
      {!isLoading && !error && myProposals.length > 0 && (
        <div className="space-y-4">
          {myProposals.map((proposal) => (
            <Link
              key={proposal.id}
              href={`/governance/proposals/${proposal.id}`}
              className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={getStatusVariant(proposal.status)}>
                      <StatusIcon status={proposal.status} />
                      <span className="ml-1">{STATUS_LABELS[proposal.status]}</span>
                    </Badge>
                    <Badge variant="outline">{TYPE_LABELS[proposal.type]}</Badge>
                  </div>
                  <h3 className="font-medium truncate">
                    {proposal.changes.label || 'Untitled Proposal'}
                  </h3>
                  {proposal.changes.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {proposal.changes.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>
                      Votes: {proposal.votes.approve} approve, {proposal.votes.reject} reject
                    </span>
                    <span>{new Date(proposal.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
