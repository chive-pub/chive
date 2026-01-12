'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FileText, Plus, Clock, CheckCircle, XCircle, Filter } from 'lucide-react';

import { useIsAuthenticated } from '@/lib/auth';
import {
  useProposals,
  STATUS_LABELS,
  TYPE_LABELS,
  CATEGORY_LABELS,
  type ProposalStatus,
  type ProposalType,
  type ProposalCategory,
} from '@/lib/hooks/use-governance';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoginPrompt } from '@/components/auth';

/**
 * Proposals list page.
 *
 * @remarks
 * Lists all proposals with filtering by status and type.
 */
export default function ProposalsPage() {
  return (
    <Suspense fallback={<ProposalsLoadingSkeleton />}>
      <ProposalsContent />
    </Suspense>
  );
}

function ProposalsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-[150px]" />
        <Skeleton className="h-10 w-[150px]" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}

function ProposalsContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') as ProposalStatus | null;
  const initialCategory = searchParams.get('category') as ProposalCategory | null;

  const [categoryFilter, setCategoryFilter] = useState<ProposalCategory | 'all'>(
    initialCategory ?? 'all'
  );
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>(initialStatus ?? 'all');
  const [typeFilter, setTypeFilter] = useState<ProposalType | 'all'>('all');

  const isAuthenticated = useIsAuthenticated();
  const { data, isLoading, error } = useProposals({
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
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

  const getStatusColor = (status: ProposalStatus) => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proposals</h1>
          <p className="text-muted-foreground">Community proposals for knowledge graph changes</p>
        </div>
        {isAuthenticated ? (
          <Button asChild>
            <Link href="/governance/proposals/new">
              <Plus className="mr-2 h-4 w-4" />
              New Proposal
            </Link>
          </Button>
        ) : (
          <LoginPrompt action="create proposals" />
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
        </div>

        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as ProposalCategory | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="field">Knowledge Graph Field</SelectItem>
            <SelectItem value="contribution-type">Contribution Type</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as ProposalStatus | 'all')}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ProposalType | 'all')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="merge">Merge</SelectItem>
            <SelectItem value="delete">Delete/Deprecate</SelectItem>
          </SelectContent>
        </Select>

        {(categoryFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCategoryFilter('all');
              setStatusFilter('all');
              setTypeFilter('all');
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Results */}
      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive">Failed to load proposals</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : data?.proposals && data.proposals.length > 0 ? (
        <div className="space-y-3">
          {data.proposals.map((proposal) => {
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
                        <Badge className={getStatusColor(proposal.status)}>
                          {STATUS_LABELS[proposal.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {proposal.rationale}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>By {proposal.proposerName ?? proposal.proposedBy}</span>
                        <span>{new Date(proposal.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Consensus Progress */}
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-medium">
                      {proposal.consensus?.approvalPercentage ?? 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {proposal.consensus?.voterCount ?? 0} votes
                    </div>
                    <div className="w-24 h-2 bg-muted rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${proposal.consensus?.approvalPercentage ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No proposals found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {categoryFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Be the first to propose a change'}
          </p>
          {isAuthenticated && (
            <Button className="mt-4" asChild>
              <Link href="/governance/proposals/new">Create Proposal</Link>
            </Button>
          )}
        </div>
      )}

      {/* Results count */}
      {data && data.total > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {data.proposals.length} of {data.total} proposals
        </p>
      )}
    </div>
  );
}
