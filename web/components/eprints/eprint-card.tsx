'use client';

import Link from 'next/link';
import { useCallback } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AuthorChipList } from './author-chip';
import { FieldBadgeList } from './field-badge';
import { StaticAbstract } from './eprint-abstract';
import { EprintSource } from './eprint-source';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/format-date';
import type { EprintSummary } from '@/lib/api/schema';

/**
 * Props for the EprintCard component.
 */
export interface EprintCardProps {
  /** Eprint summary data */
  eprint: EprintSummary;
  /** Optional callback for prefetching on hover */
  onPrefetch?: (uri: string) => void;
  /** Display variant */
  variant?: 'default' | 'compact' | 'featured';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a eprint card with title, authors, and metadata.
 *
 * @remarks
 * Client component that handles hover prefetch for improved navigation.
 * Uses Card component from UI primitives with structured content sections.
 *
 * @example
 * ```tsx
 * <EprintCard
 *   eprint={eprintData}
 *   onPrefetch={(uri) => prefetchEprint(uri)}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the eprint card
 */
export function EprintCard({
  eprint,
  onPrefetch,
  variant = 'default',
  className,
}: EprintCardProps) {
  const handleMouseEnter = useCallback(() => {
    if (onPrefetch) {
      onPrefetch(eprint.uri);
    }
  }, [onPrefetch, eprint.uri]);

  const eprintUrl = `/eprints/${encodeURIComponent(eprint.uri)}`;

  if (variant === 'compact') {
    return <CompactEprintCard eprint={eprint} className={className} />;
  }

  if (variant === 'featured') {
    return <FeaturedEprintCard eprint={eprint} onPrefetch={onPrefetch} className={className} />;
  }

  return (
    <Card
      className={cn('transition-shadow hover:shadow-md', className)}
      onMouseEnter={handleMouseEnter}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Link
              href={eprintUrl}
              className="block font-semibold leading-tight hover:text-primary hover:underline"
            >
              <h3 className="line-clamp-2">{eprint.title}</h3>
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {eprint.authors.length > 0 && (
                <AuthorChipList authors={eprint.authors} max={3} size="sm" showBadges={false} />
              )}
              <span className="text-xs text-muted-foreground">
                {formatDate(eprint.createdAt, { relative: true })}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <StaticAbstract abstract={eprint.abstract} maxLength={200} />

        {eprint.fields && eprint.fields.length > 0 && (
          <FieldBadgeList fields={eprint.fields} max={3} />
        )}

        <div className="flex items-center justify-between pt-2 text-xs">
          <EprintSource source={eprint.source} variant="inline" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Props for the CompactEprintCard component.
 */
interface CompactEprintCardProps {
  eprint: EprintSummary;
  className?: string;
}

/**
 * Compact version of the eprint card for dense list views.
 */
function CompactEprintCard({ eprint, className }: CompactEprintCardProps) {
  const eprintUrl = `/eprints/${encodeURIComponent(eprint.uri)}`;

  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <Link
          href={eprintUrl}
          className="font-medium leading-tight hover:text-primary hover:underline"
        >
          <h4 className="line-clamp-1">{eprint.title}</h4>
        </Link>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{eprint.authors[0]?.name ?? eprint.authors[0]?.handle ?? 'Unknown'}</span>
          <span>·</span>
          <span>{formatDate(eprint.createdAt, { relative: true })}</span>
        </div>
      </div>
      {eprint.fields && eprint.fields.length > 0 && (
        <FieldBadgeList fields={eprint.fields} max={1} variant="outline" />
      )}
    </div>
  );
}

/**
 * Props for the FeaturedEprintCard component.
 */
interface FeaturedEprintCardProps {
  eprint: EprintSummary;
  onPrefetch?: (uri: string) => void;
  className?: string;
}

/**
 * Featured version of the eprint card for highlighted content.
 */
function FeaturedEprintCard({ eprint, onPrefetch, className }: FeaturedEprintCardProps) {
  const handleMouseEnter = useCallback(() => {
    if (onPrefetch) {
      onPrefetch(eprint.uri);
    }
  }, [onPrefetch, eprint.uri]);

  const eprintUrl = `/eprints/${encodeURIComponent(eprint.uri)}`;

  return (
    <Card
      className={cn('border-primary/20 bg-primary/5 transition-shadow hover:shadow-lg', className)}
      onMouseEnter={handleMouseEnter}
    >
      <CardHeader>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
          Featured
        </div>
        <Link
          href={eprintUrl}
          className="block text-xl font-semibold leading-tight hover:text-primary hover:underline"
        >
          <h3 className="line-clamp-2">{eprint.title}</h3>
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {eprint.authors.length > 0 && (
            <AuthorChipList authors={eprint.authors} max={5} showBadges />
          )}
          <span className="text-sm text-muted-foreground">{formatDate(eprint.createdAt)}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <StaticAbstract abstract={eprint.abstract} maxLength={300} />

        {eprint.fields && eprint.fields.length > 0 && (
          <FieldBadgeList fields={eprint.fields} max={5} />
        )}

        <div className="flex items-center justify-between border-t pt-4 text-sm">
          <EprintSource source={eprint.source} variant="inline" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Props for the EprintCardSkeleton component.
 */
export interface EprintCardSkeletonProps {
  /** Display variant */
  variant?: 'default' | 'compact' | 'featured';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for the EprintCard component.
 *
 * @example
 * ```tsx
 * {isLoading ? <EprintCardSkeleton /> : <EprintCard eprint={data} />}
 * ```
 */
export function EprintCardSkeleton({ variant = 'default', className }: EprintCardSkeletonProps) {
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-start gap-4 rounded-lg border p-4', className)}>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="space-y-2">
          <div className="h-5 w-full animate-pulse rounded bg-muted" />
          <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-1">
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
