'use client';

import Link from 'next/link';
import { Vote, FileText, Clock, CheckCircle, XCircle, Plus } from 'lucide-react';

import { useIsAuthenticated } from '@/lib/auth';
import { useProposals, usePendingProposalsCount } from '@/lib/hooks/use-governance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LoginPrompt } from '@/components/auth';

/**
 * Governance dashboard page.
 *
 * @remarks
 * Shows overview of governance activity including pending proposals,
 * recent decisions, and quick actions.
 */
export default function GovernancePage() {
  const isAuthenticated = useIsAuthenticated();
  const { data: pendingData, isLoading: pendingLoading } = useProposals({
    status: 'open',
    limit: 5,
  });
  const { data: approvedData, isLoading: approvedLoading } = useProposals({
    status: 'approved',
    limit: 5,
  });
  const { data: rejectedData, isLoading: rejectedLoading } = useProposals({
    status: 'rejected',
    limit: 1,
  });
  const { data: pendingCount, isLoading: countLoading } = usePendingProposalsCount();

  // Calculate total from all statuses
  const totalLoading = pendingLoading || approvedLoading || rejectedLoading;
  const total =
    !totalLoading && pendingData && approvedData && rejectedData
      ? (pendingData.total ?? 0) + (approvedData.total ?? 0) + (rejectedData.total ?? 0)
      : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Governance Dashboard</h1>
          <p className="text-muted-foreground">
            Wikipedia-style community moderation for the knowledge graph
          </p>
        </div>
        {isAuthenticated && (
          <Button asChild>
            <Link href="/governance/proposals/new">
              <Plus className="mr-2 h-4 w-4" />
              New Proposal
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Pending"
          value={countLoading ? null : (pendingCount ?? 0)}
          icon={Clock}
          href="/governance/proposals?status=open"
        />
        <StatsCard
          title="Approved"
          value={approvedLoading ? null : (approvedData?.total ?? 0)}
          icon={CheckCircle}
          href="/governance/proposals?status=approved"
        />
        <StatsCard
          title="Rejected"
          value={rejectedLoading ? null : (rejectedData?.total ?? 0)}
          icon={XCircle}
          href="/governance/proposals?status=rejected"
        />
        <StatsCard
          title="Total"
          value={totalLoading ? null : total}
          icon={FileText}
          href="/governance/proposals"
        />
      </div>

      {/* Voting Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Vote className="h-5 w-5" />
            How Voting Works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Chive uses weighted voting for knowledge graph governance:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Community members: 1x weight</li>
            <li>Reviewers: 2x weight</li>
            <li>Domain experts: 3x weight</li>
            <li>Administrators: 5x weight</li>
          </ul>
          <p>
            Proposals require 67% weighted approval with a minimum of 3 votes. Editors can
            fast-track uncontroversial changes with 2+ approvals.
          </p>
        </CardContent>
      </Card>

      {/* Pending Proposals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pending Proposals</CardTitle>
            <CardDescription>Proposals awaiting community review</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/governance/proposals?status=open">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : pendingData?.proposals && pendingData.proposals.length > 0 ? (
            <div className="space-y-3">
              {pendingData.proposals.map((proposal) => (
                <Link
                  key={proposal.id}
                  href={`/governance/proposals/${proposal.id}`}
                  className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">
                        {proposal.label ?? proposal.nodeUri ?? 'Untitled'}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {proposal.rationale}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {proposal.votes.approve} / {proposal.votes.reject}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No pending proposals</p>
          )}
        </CardContent>
      </Card>

      {/* Authentication Prompt */}
      {!isAuthenticated && (
        <Card>
          <CardContent className="py-6">
            <LoginPrompt action="vote on proposals and contribute to governance" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Stats card component.
 */
function StatsCard({
  title,
  value,
  icon: Icon,
  href,
}: {
  title: string;
  value: number | null;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        <Link href={href} className="text-xs text-primary hover:underline mt-1 inline-block">
          View →
        </Link>
      </CardContent>
    </Card>
  );
}
