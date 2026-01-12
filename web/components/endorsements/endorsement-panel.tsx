'use client';

/**
 * Panel displaying all endorsements for a eprint.
 *
 * @remarks
 * Displays endorsements grouped by contribution type with filtering support.
 * Supports 15 fine-grained contribution types derived from CRediT taxonomy.
 *
 * @example
 * ```tsx
 * <EndorsementPanel eprintUri={eprintUri} />
 * ```
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import { ThumbsUp, Users, Filter } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ContributionType, Endorsement } from '@/lib/api/schema';
import {
  useEndorsements,
  useEndorsementSummary,
  CONTRIBUTION_TYPE_LABELS,
} from '@/lib/hooks/use-endorsement';
import {
  EndorsementBadgeGroup,
  EndorsementBadgeSkeleton,
  EndorsementSummaryBadge,
} from './endorsement-badge';
import { EndorsementList, EndorsementListSkeleton } from './endorsement-list';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for EndorsementPanel.
 */
export interface EndorsementPanelProps {
  /** AT-URI of the eprint */
  eprintUri: string;

  /** Open endorsement form */
  onEndorse?: () => void;

  /** Callback when share button is clicked for an endorsement */
  onShareEndorsement?: (endorsement: Endorsement) => void;

  /** Current user's DID (for showing endorsement status) */
  currentUserDid?: string;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Displays endorsement summary and list for a eprint.
 *
 * @param props - Component props
 * @returns Panel element
 */
export function EndorsementPanel({
  eprintUri,
  onEndorse,
  onShareEndorsement,
  currentUserDid: _currentUserDid,
  className,
}: EndorsementPanelProps) {
  const [selectedType, setSelectedType] = useState<ContributionType | 'all'>('all');

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useEndorsementSummary(eprintUri);

  const {
    data: endorsementsData,
    isLoading: endorsementsLoading,
    error: endorsementsError,
  } = useEndorsements(eprintUri);

  const isLoading = summaryLoading || endorsementsLoading;
  const error = summaryError || endorsementsError;

  if (error) {
    return (
      <Card className={cn('', className)}>
        <CardContent className="py-6">
          <p className="text-center text-destructive">Failed to load endorsements</p>
        </CardContent>
      </Card>
    );
  }

  const endorsements = endorsementsData?.endorsements ?? [];

  // Filter endorsements by selected contribution type
  const filteredEndorsements =
    selectedType === 'all'
      ? endorsements
      : endorsements.filter((e) => e.contributions.includes(selectedType));

  // Get available contribution types for the filter dropdown
  const availableTypes = summary?.byType
    ? (Object.entries(summary.byType)
        .filter(([, count]) => count && count > 0)
        .map(([type]) => type) as ContributionType[])
    : [];

  return (
    <Card className={cn('', className)} data-testid="endorsement-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ThumbsUp className="h-5 w-5" />
            Endorsements
          </CardTitle>

          {onEndorse && (
            <Button size="sm" onClick={onEndorse}>
              Endorse
            </Button>
          )}
        </div>

        {/* Summary badges */}
        {isLoading ? (
          <div className="flex gap-2 mt-2">
            <EndorsementBadgeSkeleton />
            <EndorsementBadgeSkeleton />
            <EndorsementBadgeSkeleton />
          </div>
        ) : summary ? (
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <EndorsementBadgeGroup
              summary={summary}
              showLabels
              interactive
              maxBadges={5}
              onBadgeClick={(type) => setSelectedType(type)}
            />
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Users className="h-4 w-4" />
              {summary.endorserCount} {summary.endorserCount === 1 ? 'endorser' : 'endorsers'}
            </span>
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        {/* Filter dropdown */}
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedType}
            onValueChange={(v) => setSelectedType(v as ContributionType | 'all')}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All endorsements</SelectItem>
              {availableTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {CONTRIBUTION_TYPE_LABELS[type]} ({summary?.byType?.[type] ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedType !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedType('all')}>
              Clear
            </Button>
          )}
        </div>

        {/* Endorsement list */}
        {isLoading ? (
          <EndorsementListSkeleton count={3} />
        ) : (
          <EndorsementList
            endorsements={filteredEndorsements}
            showComments
            variant="list"
            onShareEndorsement={onShareEndorsement}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact endorsement summary for eprint cards.
 */
export function EndorsementSummaryCompact({
  eprintUri,
  className,
}: {
  eprintUri: string;
  className?: string;
}) {
  const { data: summary, isLoading } = useEndorsementSummary(eprintUri);

  if (isLoading) {
    return (
      <div className={cn('flex gap-1', className)}>
        <EndorsementBadgeSkeleton size="sm" />
      </div>
    );
  }

  if (!summary || summary.total === 0) {
    return null;
  }

  return <EndorsementBadgeGroup summary={summary} size="sm" maxBadges={3} className={className} />;
}

/**
 * Minimal endorsement indicator showing just total count.
 */
export function EndorsementIndicator({
  eprintUri,
  className,
}: {
  eprintUri: string;
  className?: string;
}) {
  const { data: summary, isLoading } = useEndorsementSummary(eprintUri);

  if (isLoading) {
    return <EndorsementBadgeSkeleton size="sm" />;
  }

  if (!summary || summary.total === 0) {
    return null;
  }

  return (
    <EndorsementSummaryBadge
      total={summary.total}
      endorserCount={summary.endorserCount}
      size="sm"
      className={className}
    />
  );
}
