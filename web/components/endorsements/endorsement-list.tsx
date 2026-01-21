'use client';

/**
 * EndorsementList component for displaying individual endorsements.
 *
 * @remarks
 * Shows a list of endorsers with their avatars, names, contribution types, and optional comments.
 * Supports filtering by contribution type and limiting displayed items.
 * Each endorsement can have multiple contribution types.
 *
 * @example
 * ```tsx
 * <EndorsementList
 *   endorsements={endorsements}
 *   contributionType="methodological"
 *   limit={5}
 * />
 * ```
 *
 * @packageDocumentation
 */

import Link from 'next/link';
import { Share2 } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatRelativeDate } from '@/lib/utils/format-date';
import type { Endorsement, ContributionType } from '@/lib/api/schema';
import { getContributionConfig } from './endorsement-badge';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the EndorsementList component.
 */
export interface EndorsementListProps {
  /** Endorsements to display */
  endorsements: Endorsement[];

  /** Filter by contribution type */
  contributionType?: ContributionType;

  /** Maximum number of endorsements to show */
  limit?: number;

  /** Whether to show endorsement comments */
  showComments?: boolean;

  /** Layout variant */
  variant?: 'list' | 'compact' | 'avatars-only';

  /** Callback when share button is clicked for an endorsement */
  onShareEndorsement?: (endorsement: Endorsement) => void;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for the EndorsementItem component.
 */
export interface EndorsementItemProps {
  /** The endorsement to display */
  endorsement: Endorsement;

  /** Whether to show the comment */
  showComment?: boolean;

  /** Display variant */
  variant?: 'list' | 'compact';

  /** Maximum number of contribution badges to show */
  maxBadges?: number;

  /** Callback when share button is clicked */
  onShare?: () => void;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Gets initials from a display name.
 */
function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Displays a single endorsement with multiple contribution types.
 */
export function EndorsementItem({
  endorsement,
  showComment = true,
  variant = 'list',
  maxBadges = 3,
  onShare,
  className,
}: EndorsementItemProps) {
  const isCompact = variant === 'compact';
  const contributions = endorsement.contributions ?? [];
  const visibleContributions = contributions.slice(0, maxBadges);
  const hiddenCount = contributions.length - maxBadges;

  return (
    <div
      className={cn('group flex items-start gap-3', isCompact ? 'py-2' : 'py-3', className)}
      data-testid="endorsement-item"
    >
      <Link href={`/authors/${encodeURIComponent(endorsement.endorser.did)}`} className="shrink-0">
        <Avatar className={cn(isCompact ? 'h-6 w-6' : 'h-8 w-8')}>
          <AvatarImage src={endorsement.endorser.avatar} alt={endorsement.endorser.displayName} />
          <AvatarFallback className="text-xs">
            {getInitials(endorsement.endorser.displayName)}
          </AvatarFallback>
        </Avatar>
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/authors/${encodeURIComponent(endorsement.endorser.did)}`}
            className={cn(
              'font-medium hover:underline truncate',
              isCompact ? 'text-sm' : 'text-base'
            )}
          >
            {endorsement.endorser.displayName || endorsement.endorser.handle || 'Anonymous'}
          </Link>

          {/* Contribution type badges */}
          {visibleContributions.map((type) => {
            const config = getContributionConfig(type);
            const Icon = config.icon;
            return (
              <Badge
                key={type}
                variant="secondary"
                className={cn('flex items-center gap-1 text-xs', config.colorClass, config.bgClass)}
              >
                <Icon className="h-3 w-3" />
                <span>{config.label}</span>
              </Badge>
            );
          })}

          {hiddenCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-xs">
                    +{hiddenCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {contributions.slice(maxBadges).map((type) => (
                    <p key={type}>{getContributionConfig(type).label}</p>
                  ))}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <time
            dateTime={endorsement.createdAt}
            className="text-xs text-muted-foreground"
            title={new Date(endorsement.createdAt).toLocaleString()}
          >
            {formatRelativeDate(endorsement.createdAt)}
          </time>

          {onShare && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onShare}
              aria-label="Share endorsement"
            >
              <Share2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {showComment && endorsement.comment && (
          <p className={cn('mt-1 text-muted-foreground', isCompact ? 'text-xs' : 'text-sm')}>
            {endorsement.comment}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Displays a stack of avatar images for multiple endorsers.
 */
export function EndorserAvatarStack({
  endorsements,
  limit = 5,
  size = 'md',
  className,
}: {
  endorsements: Endorsement[];
  limit?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const displayed = endorsements.slice(0, limit);
  const remaining = endorsements.length - limit;

  const sizeClasses = {
    sm: 'h-5 w-5 -ml-1.5 first:ml-0',
    md: 'h-6 w-6 -ml-2 first:ml-0',
    lg: 'h-8 w-8 -ml-2.5 first:ml-0',
  };

  return (
    <TooltipProvider>
      <div className={cn('flex items-center', className)} data-testid="endorser-avatar-stack">
        {displayed.map((endorsement, index) => (
          <Tooltip key={endorsement.uri}>
            <TooltipTrigger asChild>
              <Link
                href={`/authors/${encodeURIComponent(endorsement.endorser.did)}`}
                className={cn('relative rounded-full ring-2 ring-background', sizeClasses[size])}
                style={{ zIndex: displayed.length - index }}
              >
                <Avatar className="h-full w-full">
                  <AvatarImage
                    src={endorsement.endorser.avatar}
                    alt={endorsement.endorser.displayName}
                  />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(endorsement.endorser.displayName)}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>{endorsement.endorser.displayName || endorsement.endorser.handle}</p>
              <p className="text-xs text-muted-foreground">
                {endorsement.contributions.length} contribution type
                {endorsement.contributions.length !== 1 ? 's' : ''}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}

        {remaining > 0 && (
          <div
            className={cn(
              'flex items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-background',
              sizeClasses[size]
            )}
            style={{ zIndex: 0 }}
          >
            +{remaining}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Displays a list of endorsements.
 *
 * @param props - Component props
 * @returns Endorsement list element
 */
export function EndorsementList({
  endorsements,
  contributionType,
  limit,
  showComments = true,
  variant = 'list',
  onShareEndorsement,
  className,
}: EndorsementListProps) {
  // Filter by contribution type if specified
  const filtered = contributionType
    ? endorsements.filter((e) => e.contributions.includes(contributionType))
    : endorsements;

  // Apply limit
  const displayed = limit ? filtered.slice(0, limit) : filtered;
  const remaining = limit ? filtered.length - limit : 0;

  if (filtered.length === 0) {
    return (
      <div
        className={cn('py-4 text-center text-muted-foreground', className)}
        data-testid="endorsement-list-empty"
      >
        <p className="text-sm">No endorsements yet</p>
      </div>
    );
  }

  // Avatar-only variant
  if (variant === 'avatars-only') {
    return (
      <EndorserAvatarStack endorsements={displayed} limit={limit || 5} className={className} />
    );
  }

  return (
    <div className={cn('divide-y divide-border', className)} data-testid="endorsement-list">
      {displayed.map((endorsement) => (
        <EndorsementItem
          key={endorsement.uri}
          endorsement={endorsement}
          showComment={showComments}
          variant={variant === 'compact' ? 'compact' : 'list'}
          onShare={onShareEndorsement ? () => onShareEndorsement(endorsement) : undefined}
        />
      ))}

      {remaining > 0 && (
        <div className="py-2 text-center">
          <span className="text-sm text-muted-foreground">
            +{remaining} more endorsement{remaining !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton loading state for EndorsementList.
 */
export function EndorsementListSkeleton({
  count = 3,
  variant = 'list',
}: {
  count?: number;
  variant?: 'list' | 'compact';
}) {
  const isCompact = variant === 'compact';

  return (
    <div className="divide-y divide-border" data-testid="endorsement-list-skeleton">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn('flex items-start gap-3 animate-pulse', isCompact ? 'py-2' : 'py-3')}
        >
          <div className={cn('rounded-full bg-muted', isCompact ? 'h-6 w-6' : 'h-8 w-8')} />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
            </div>
            {!isCompact && <div className="h-3 w-full rounded bg-muted" />}
          </div>
        </div>
      ))}
    </div>
  );
}
