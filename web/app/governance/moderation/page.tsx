'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Filter,
  Users,
  AlertCircle,
} from 'lucide-react';

import { useIsAuthenticated } from '@/lib/auth';
import {
  useProposals,
  usePendingProposalsCount,
  TYPE_LABELS,
  type ProposalStatus,
  type ProposalType,
} from '@/lib/hooks/use-governance';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoginPrompt } from '@/components/auth';
import { Progress } from '@/components/ui/progress';

/**
 * Moderation dashboard for editors.
 *
 * @remarks
 * Provides an overview of pending proposals with quick filters and
 * fast-track visibility for proposals with multiple editor approvals.
 */
export default function ModerationPage() {
  const [typeFilter, setTypeFilter] = useState<ProposalType | 'all'>('all');

  const isAuthenticated = useIsAuthenticated();
  const { data: pendingCount } = usePendingProposalsCount();
  const {
    data: pendingData,
    isLoading: pendingLoading,
    error: pendingError,
  } = useProposals({
    status: 'pending',
    type: typeFilter === 'all' ? undefined : typeFilter,
    limit: 50,
  });

  const getStatusIcon = (status: ProposalStatus) => {
    switch (status) {
      case 'pending':
        return Clock;
      case 'approved':
        return CheckCircle;
      case 'rejected':
        return XCircle;
      default:
        return FileText;
    }
  };

  // Calculate fast-track candidates (proposals with 2+ approvals)
  const fastTrackCandidates =
    pendingData?.proposals.filter(
      (p) => p.consensus && p.consensus.voterCount >= 2 && p.consensus.approvalPercentage >= 75
    ) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Moderation Dashboard
        </h1>
        <p className="text-muted-foreground">
          Review and manage community proposals for knowledge graph changes
        </p>
      </div>

      {!isAuthenticated ? (
        <Card>
          <CardContent className="pt-6">
            <LoginPrompt action="access the moderation dashboard" />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingCount ?? 0}</div>
                <p className="text-xs text-muted-foreground">proposals awaiting votes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fast-Track Ready</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fastTrackCandidates.length}</div>
                <p className="text-xs text-muted-foreground">proposals with 2+ approvals</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {pendingData?.proposals.filter((p) => p.consensus && p.consensus.voterCount === 0)
                    .length ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">proposals with no votes</p>
              </CardContent>
            </Card>
          </div>

          {/* Fast-Track Section */}
          {fastTrackCandidates.length > 0 && (
            <Card className="border-green-200 dark:border-green-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Fast-Track Candidates
                </CardTitle>
                <CardDescription>
                  These proposals have significant community support and may be ready for approval
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fastTrackCandidates.map((proposal) => (
                    <Link
                      key={proposal.id}
                      href={`/governance/proposals/${proposal.id}`}
                      className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">
                              {proposal.label ?? proposal.fieldId ?? 'Untitled'}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {TYPE_LABELS[proposal.type]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {proposal.consensus?.voterCount ?? 0} votes •{' '}
                            {proposal.consensus?.approvalPercentage ?? 0}% approval
                          </p>
                        </div>
                        <Button size="sm">Review</Button>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Proposals */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pending Proposals</CardTitle>
                  <CardDescription>All proposals awaiting community review</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={typeFilter}
                    onValueChange={(v) => setTypeFilter(v as ProposalType | 'all')}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="create">Create</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="merge">Merge</SelectItem>
                      <SelectItem value="delete">Delete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pendingError ? (
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
                  <p className="text-destructive">Failed to load proposals</p>
                </div>
              ) : pendingLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : pendingData?.proposals && pendingData.proposals.length > 0 ? (
                <div className="space-y-3">
                  {pendingData.proposals.map((proposal) => {
                    const StatusIcon = getStatusIcon(proposal.status);
                    return (
                      <Link
                        key={proposal.id}
                        href={`/governance/proposals/${proposal.id}`}
                        className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <StatusIcon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium truncate">
                                  {proposal.label ?? proposal.fieldId ?? 'Untitled'}
                                </h3>
                                <Badge variant="outline" className="text-xs">
                                  {TYPE_LABELS[proposal.type]}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                {proposal.rationale}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {proposal.consensus?.voterCount ?? 0} votes
                                </span>
                                <span>{new Date(proposal.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* Progress */}
                          <div className="shrink-0 w-24">
                            <div className="text-right text-sm font-medium">
                              {proposal.consensus?.approvalPercentage ?? 0}%
                            </div>
                            <Progress
                              value={proposal.consensus?.approvalPercentage ?? 0}
                              className="h-2 mt-1"
                            />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed p-12 text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No pending proposals</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {typeFilter !== 'all'
                      ? 'Try a different filter'
                      : 'All proposals have been reviewed'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
