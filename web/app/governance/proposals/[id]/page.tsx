'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ThumbsUp, ThumbsDown, MinusCircle } from 'lucide-react';

import { useIsAuthenticated, useCurrentUser } from '@/lib/auth';
import {
  useProposal,
  useProposalVotes,
  useMyVote,
  useCreateVote,
  STATUS_LABELS,
  TYPE_LABELS,
  ROLE_LABELS,
  VOTE_LABELS,
  VOTE_WEIGHTS,
  CONSENSUS_THRESHOLD,
  MINIMUM_VOTES,
  type VoteAction,
  type VoteValue,
} from '@/lib/hooks/use-governance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { LoginPrompt } from '@/components/auth';

/**
 * Proposal detail page with voting interface.
 */
export default function ProposalDetailPage() {
  const params = useParams();
  const proposalId = params.id as string;

  const isAuthenticated = useIsAuthenticated();
  const currentUser = useCurrentUser();

  const { data: proposal, isLoading, error } = useProposal(proposalId);
  const { data: votesData, isLoading: votesLoading } = useProposalVotes(proposalId);
  const { data: myVote, isLoading: myVoteLoading } = useMyVote(proposalId, currentUser?.did ?? '', {
    enabled: isAuthenticated,
  });

  const createVote = useCreateVote();
  const [voteRationale, setVoteRationale] = useState('');
  const [selectedVote, setSelectedVote] = useState<VoteValue | null>(null);

  const handleVote = async (value: VoteValue) => {
    if (!isAuthenticated) return;

    await createVote.mutateAsync({
      proposalId,
      vote: value,
      rationale: voteRationale.trim() || undefined,
    });

    setVoteRationale('');
    setSelectedVote(null);
  };

  if (isLoading) {
    return <ProposalDetailSkeleton />;
  }

  if (error || !proposal) {
    return (
      <div className="space-y-6">
        <Link
          href="/governance/proposals"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to proposals
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive">Proposal not found</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return '';
    }
  };

  const getVoteIcon = (vote: VoteAction) => {
    switch (vote) {
      case 'approve':
        return ThumbsUp;
      case 'reject':
        return ThumbsDown;
      case 'abstain':
      case 'request-changes':
        return MinusCircle;
    }
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/governance/proposals"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to proposals
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{TYPE_LABELS[proposal.type]}</Badge>
          <Badge className={getStatusColor(proposal.status)}>
            {STATUS_LABELS[proposal.status]}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {proposal.label ?? proposal.fieldId ?? 'Untitled Proposal'}
        </h1>
        <p className="text-muted-foreground">
          Proposed by {proposal.proposerName ?? proposal.proposedBy} on{' '}
          {new Date(proposal.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rationale */}
          <Card>
            <CardHeader>
              <CardTitle>Rationale</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{proposal.rationale}</p>
            </CardContent>
          </Card>

          {/* Proposed Changes */}
          <Card>
            <CardHeader>
              <CardTitle>Proposed Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                {proposal.changes.label && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Label</dt>
                    <dd className="mt-1">{proposal.changes.label}</dd>
                  </div>
                )}
                {proposal.changes.description && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Description</dt>
                    <dd className="mt-1">{proposal.changes.description}</dd>
                  </div>
                )}
                {proposal.changes.fieldType && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Type</dt>
                    <dd className="mt-1 capitalize">{proposal.changes.fieldType}</dd>
                  </div>
                )}
                {proposal.changes.parentId && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Parent Field</dt>
                    <dd className="mt-1">{proposal.changes.parentId}</dd>
                  </div>
                )}
                {proposal.changes.wikidataId && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Wikidata ID</dt>
                    <dd className="mt-1">
                      <a
                        href={`https://www.wikidata.org/wiki/${proposal.changes.wikidataId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {proposal.changes.wikidataId}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Votes */}
          <Card>
            <CardHeader>
              <CardTitle>Votes ({votesData?.total ?? 0})</CardTitle>
              <CardDescription>Community votes on this proposal</CardDescription>
            </CardHeader>
            <CardContent>
              {votesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : votesData?.votes && votesData.votes.length > 0 ? (
                <div className="space-y-3">
                  {votesData.votes.map((vote) => {
                    const VoteIcon = getVoteIcon(vote.vote);
                    return (
                      <div
                        key={vote.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <VoteIcon className="h-5 w-5 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{vote.voterName ?? vote.voterDid}</span>
                            <Badge variant="outline" className="text-xs">
                              {ROLE_LABELS[vote.voterRole]} ({VOTE_WEIGHTS[vote.voterRole]}x)
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{VOTE_LABELS[vote.vote]}</p>
                          {vote.rationale && <p className="text-sm mt-1">{vote.rationale}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(vote.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No votes yet. Be the first to vote!
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Consensus Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Consensus Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Approval</span>
                  <span className="font-medium">
                    {proposal.consensus?.approvalPercentage ?? 0}%
                  </span>
                </div>
                <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-primary rounded-full transition-all"
                    style={{ width: `${proposal.consensus?.approvalPercentage ?? 0}%` }}
                  />
                  <div
                    className="absolute h-full w-0.5 bg-muted-foreground/50"
                    style={{ left: `${CONSENSUS_THRESHOLD}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {CONSENSUS_THRESHOLD}% threshold
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">{proposal.votes.approve}</div>
                  <div className="text-xs text-muted-foreground">Approve</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{proposal.votes.reject}</div>
                  <div className="text-xs text-muted-foreground">Reject</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-muted-foreground">
                    {proposal.votes.abstain}
                  </div>
                  <div className="text-xs text-muted-foreground">Abstain</div>
                </div>
              </div>

              <Separator />

              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Voters</span>
                  <span>
                    {proposal.consensus?.voterCount ?? 0} / {MINIMUM_VOTES} min
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span>
                    {proposal.consensus?.consensusReached ? 'Consensus reached' : 'Awaiting votes'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Voting Interface */}
          {proposal.status === 'pending' && (
            <Card>
              <CardHeader>
                <CardTitle>Cast Your Vote</CardTitle>
              </CardHeader>
              <CardContent>
                {!isAuthenticated ? (
                  <LoginPrompt action="vote on this proposal" />
                ) : myVoteLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : myVote ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      You voted: <strong>{VOTE_LABELS[myVote.vote]}</strong>
                    </p>
                    {myVote.rationale && (
                      <p className="text-sm mt-2">&ldquo;{myVote.rationale}&rdquo;</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={selectedVote === 'approve' ? 'default' : 'outline'}
                        className="gap-2"
                        onClick={() => setSelectedVote('approve')}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant={selectedVote === 'reject' ? 'destructive' : 'outline'}
                        className="gap-2"
                        onClick={() => setSelectedVote('reject')}
                      >
                        <ThumbsDown className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>

                    <Textarea
                      placeholder="Optional rationale for your vote..."
                      value={voteRationale}
                      onChange={(e) => setVoteRationale(e.target.value)}
                      className="min-h-[80px]"
                    />

                    <Button
                      className="w-full"
                      disabled={!selectedVote || createVote.isPending}
                      onClick={() => selectedVote && handleVote(selectedVote)}
                    >
                      {createVote.isPending ? 'Submitting...' : 'Submit Vote'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for proposal detail.
 */
function ProposalDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
