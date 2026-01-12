'use client';

/**
 * Contribution type proposal voting component.
 *
 * @remarks
 * Allows authenticated users to vote on contribution type proposals.
 * Displays current vote tally and user's existing vote if any.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, Minus, Loader2, Check, MessageSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';
import {
  useMyContributionTypeVote,
  useVoteOnContributionTypeProposal,
  type ContributionTypeProposal,
  type ContributionTypeVote,
  CONTRIBUTION_TYPE_CONSENSUS_THRESHOLD,
  CONTRIBUTION_TYPE_MINIMUM_VOTES,
} from '@/lib/hooks/use-contribution-types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for ContributionTypeVotePanel component.
 */
export interface ContributionTypeVotePanelProps {
  /** Proposal to vote on */
  proposal: ContributionTypeProposal;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Vote value type.
 */
type VoteValue = 'approve' | 'reject' | 'abstain';

// =============================================================================
// CONSTANTS
// =============================================================================

const VOTE_OPTIONS: Array<{
  value: VoteValue;
  label: string;
  icon: typeof ThumbsUp;
  color: string;
  bgColor: string;
}> = [
  {
    value: 'approve',
    label: 'Approve',
    icon: ThumbsUp,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 hover:bg-green-200 dark:bg-green-900/50 dark:hover:bg-green-900',
  },
  {
    value: 'reject',
    label: 'Reject',
    icon: ThumbsDown,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900',
  },
  {
    value: 'abstain',
    label: 'Abstain',
    icon: Minus,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700',
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Voting panel for contribution type proposals.
 *
 * @param props - Component props
 * @returns Vote panel element
 */
export function ContributionTypeVotePanel({ proposal, className }: ContributionTypeVotePanelProps) {
  const { user, isAuthenticated } = useAuth();
  const { data: existingVote, isLoading: isLoadingVote } = useMyContributionTypeVote(
    proposal.uri,
    user?.did ?? '',
    { enabled: !!user?.did }
  );
  const voteMutation = useVoteOnContributionTypeProposal();

  const [selectedVote, setSelectedVote] = useState<VoteValue | null>(null);
  const [rationale, setRationale] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Calculate approval percentage
  const totalWeightedVotes = proposal.votes.weightedApprove + proposal.votes.weightedReject;
  const approvalPercentage =
    totalWeightedVotes > 0
      ? Math.round((proposal.votes.weightedApprove / totalWeightedVotes) * 100)
      : 0;
  const meetsThreshold = approvalPercentage >= CONTRIBUTION_TYPE_CONSENSUS_THRESHOLD;
  const meetsMinimumVotes = proposal.votes.total >= CONTRIBUTION_TYPE_MINIMUM_VOTES;

  const handleVoteClick = useCallback((value: VoteValue) => {
    setSelectedVote(value);
    setIsDialogOpen(true);
    setSubmitError(null);
  }, []);

  const handleSubmitVote = useCallback(async () => {
    if (!selectedVote) return;

    try {
      await voteMutation.mutateAsync({
        proposalUri: proposal.uri,
        value: selectedVote,
        rationale: rationale.trim() || undefined,
      });
      setIsDialogOpen(false);
      setSelectedVote(null);
      setRationale('');
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to submit vote. Please try again.'
      );
    }
  }, [selectedVote, rationale, proposal.uri, voteMutation]);

  const hasVoted = !!existingVote;
  const isPending = proposal.status === 'pending';

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Community Vote</CardTitle>
        <CardDescription>Cast your vote on this contribution type proposal</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Vote Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Approval Progress</span>
            <span
              className={cn(
                'font-semibold',
                meetsThreshold && meetsMinimumVotes ? 'text-green-600' : 'text-muted-foreground'
              )}
            >
              {approvalPercentage}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                meetsThreshold && meetsMinimumVotes ? 'bg-green-500' : 'bg-primary'
              )}
              style={{ width: `${approvalPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {proposal.votes.approve} approve · {proposal.votes.reject} reject ·{' '}
              {proposal.votes.abstain} abstain
            </span>
            <span>{CONTRIBUTION_TYPE_CONSENSUS_THRESHOLD}% required</span>
          </div>
          {!meetsMinimumVotes && (
            <p className="text-xs text-muted-foreground">
              Needs {CONTRIBUTION_TYPE_MINIMUM_VOTES - proposal.votes.total} more vote(s) to reach
              minimum
            </p>
          )}
        </div>

        {/* Existing Vote Display */}
        {hasVoted && existingVote && (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>
              You voted to{' '}
              <span className="font-medium">
                {VOTE_OPTIONS.find((o) => o.value === existingVote.value)?.label.toLowerCase()}
              </span>{' '}
              this proposal.
              {existingVote.rationale && (
                <span className="block mt-1 text-muted-foreground italic">
                  &quot;{existingVote.rationale}&quot;
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Vote Buttons */}
        {isPending && !hasVoted && (
          <>
            {!isAuthenticated ? (
              <Alert>
                <AlertDescription>You must be logged in to vote on proposals.</AlertDescription>
              </Alert>
            ) : isLoadingVote ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {VOTE_OPTIONS.map((option) => (
                  <Dialog
                    key={option.value}
                    open={isDialogOpen && selectedVote === option.value}
                    onOpenChange={(open) => {
                      if (!open) {
                        setIsDialogOpen(false);
                        setSelectedVote(null);
                        setSubmitError(null);
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn('flex-col h-auto py-4 gap-2', option.bgColor)}
                        onClick={() => handleVoteClick(option.value)}
                      >
                        <option.icon className={cn('h-5 w-5', option.color)} />
                        <span className={option.color}>{option.label}</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{option.label} Proposal</DialogTitle>
                        <DialogDescription>
                          You are about to vote to {option.label.toLowerCase()} the contribution
                          type proposal for &quot;{proposal.proposedLabel}&quot;.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="rationale">
                            Rationale{' '}
                            <span className="text-muted-foreground font-normal">(optional)</span>
                          </Label>
                          <Textarea
                            id="rationale"
                            placeholder="Explain your reasoning for this vote..."
                            value={rationale}
                            onChange={(e) => setRationale(e.target.value)}
                            rows={3}
                            maxLength={500}
                          />
                          <p className="text-xs text-muted-foreground">
                            {rationale.length}/500 characters
                          </p>
                        </div>

                        {submitError && (
                          <Alert variant="destructive">
                            <AlertDescription>{submitError}</AlertDescription>
                          </Alert>
                        )}
                      </div>

                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                          disabled={voteMutation.isPending}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSubmitVote}
                          disabled={voteMutation.isPending}
                          className={cn(
                            option.value === 'approve' && 'bg-green-600 hover:bg-green-700',
                            option.value === 'reject' && 'bg-red-600 hover:bg-red-700'
                          )}
                        >
                          {voteMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <option.icon className="h-4 w-4 mr-2" />
                              Confirm {option.label}
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            )}
          </>
        )}

        {/* Closed voting notice */}
        {!isPending && (
          <Alert>
            <AlertDescription>
              Voting is closed. This proposal has been{' '}
              <span className="font-medium">{proposal.status}</span>.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// VOTE LIST COMPONENT
// =============================================================================

/**
 * Props for ContributionTypeVoteList component.
 */
export interface ContributionTypeVoteListProps {
  /** List of votes */
  votes: ContributionTypeVote[];
  /** Whether data is loading */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a list of votes on a contribution type proposal.
 *
 * @param props - Component props
 * @returns Vote list element
 */
export function ContributionTypeVoteList({
  votes,
  isLoading = false,
  className,
}: ContributionTypeVoteListProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (votes.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        No votes yet. Be the first to vote!
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {votes.map((vote) => {
        const option = VOTE_OPTIONS.find((o) => o.value === vote.value);
        const Icon = option?.icon ?? ThumbsUp;

        return (
          <div key={vote.uri} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <div
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-full',
                option?.bgColor
              )}
            >
              <Icon className={cn('h-4 w-4', option?.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {vote.voterName ?? `@${vote.voterDid.slice(-8)}`}
                </span>
                <span className={cn('text-sm', option?.color)}>{option?.label}</span>
                {vote.weight > 1 && (
                  <span className="text-xs text-muted-foreground">({vote.weight}x weight)</span>
                )}
              </div>
              {vote.rationale && (
                <p className="text-sm text-muted-foreground mt-1 flex items-start gap-1">
                  <MessageSquare className="h-3 w-3 mt-1 flex-shrink-0" />
                  <span className="italic">{vote.rationale}</span>
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
