'use client';

import Link from 'next/link';
import { useCallback } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AuthorChipList } from './author-chip';
import { FieldBadgeList } from './field-badge';
import { StaticAbstract } from './preprint-abstract';
import { PreprintSource } from './preprint-source';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/format-date';
import type { PreprintSummary } from '@/lib/api/schema';

/**
 * Props for the PreprintCard component.
 */
export interface PreprintCardProps {
  /** Preprint summary data */
  preprint: PreprintSummary;
  /** Optional callback for prefetching on hover */
  onPrefetch?: (uri: string) => void;
  /** Display variant */
  variant?: 'default' | 'compact' | 'featured';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a preprint card with title, authors, and metadata.
 *
 * @remarks
 * Client component that handles hover prefetch for improved navigation.
 * Uses Card component from UI primitives with structured content sections.
 *
 * @example
 * ```tsx
 * <PreprintCard
 *   preprint={preprintData}
 *   onPrefetch={(uri) => prefetchPreprint(uri)}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the preprint card
 */
export function PreprintCard({
  preprint,
  onPrefetch,
  variant = 'default',
  className,
}: PreprintCardProps) {
  const handleMouseEnter = useCallback(() => {
    if (onPrefetch) {
      onPrefetch(preprint.uri);
    }
  }, [onPrefetch, preprint.uri]);

  const preprintUrl = `/preprints/${encodeURIComponent(preprint.uri)}`;

  if (variant === 'compact') {
    return <CompactPreprintCard preprint={preprint} className={className} />;
  }

  if (variant === 'featured') {
    return (
      <FeaturedPreprintCard preprint={preprint} onPrefetch={onPrefetch} className={className} />
    );
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
              href={preprintUrl}
              className="block font-semibold leading-tight hover:text-primary hover:underline"
            >
              <h3 className="line-clamp-2">{preprint.title}</h3>
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {preprint.authors.length > 0 && (
                <AuthorChipList authors={preprint.authors} max={3} size="sm" showBadges={false} />
              )}
              <span className="text-xs text-muted-foreground">
                {formatDate(preprint.createdAt, { relative: true })}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <StaticAbstract abstract={preprint.abstract} maxLength={200} />

        {preprint.fields && preprint.fields.length > 0 && (
          <FieldBadgeList fields={preprint.fields} max={3} />
        )}

        <div className="flex items-center justify-between pt-2 text-xs">
          <PreprintSource source={preprint.source} variant="inline" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Props for the CompactPreprintCard component.
 */
interface CompactPreprintCardProps {
  preprint: PreprintSummary;
  className?: string;
}

/**
 * Compact version of the preprint card for dense list views.
 */
function CompactPreprintCard({ preprint, className }: CompactPreprintCardProps) {
  const preprintUrl = `/preprints/${encodeURIComponent(preprint.uri)}`;

  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <Link
          href={preprintUrl}
          className="font-medium leading-tight hover:text-primary hover:underline"
        >
          <h4 className="line-clamp-1">{preprint.title}</h4>
        </Link>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{preprint.authors[0]?.name ?? preprint.authors[0]?.handle ?? 'Unknown'}</span>
          <span>·</span>
          <span>{formatDate(preprint.createdAt, { relative: true })}</span>
        </div>
      </div>
      {preprint.fields && preprint.fields.length > 0 && (
        <FieldBadgeList fields={preprint.fields} max={1} variant="outline" />
      )}
    </div>
  );
}

/**
 * Props for the FeaturedPreprintCard component.
 */
interface FeaturedPreprintCardProps {
  preprint: PreprintSummary;
  onPrefetch?: (uri: string) => void;
  className?: string;
}

/**
 * Featured version of the preprint card for highlighted content.
 */
function FeaturedPreprintCard({ preprint, onPrefetch, className }: FeaturedPreprintCardProps) {
  const handleMouseEnter = useCallback(() => {
    if (onPrefetch) {
      onPrefetch(preprint.uri);
    }
  }, [onPrefetch, preprint.uri]);

  const preprintUrl = `/preprints/${encodeURIComponent(preprint.uri)}`;

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
          href={preprintUrl}
          className="block text-xl font-semibold leading-tight hover:text-primary hover:underline"
        >
          <h3 className="line-clamp-2">{preprint.title}</h3>
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {preprint.authors.length > 0 && (
            <AuthorChipList authors={preprint.authors} max={5} showBadges />
          )}
          <span className="text-sm text-muted-foreground">{formatDate(preprint.createdAt)}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <StaticAbstract abstract={preprint.abstract} maxLength={300} />

        {preprint.fields && preprint.fields.length > 0 && (
          <FieldBadgeList fields={preprint.fields} max={5} />
        )}

        <div className="flex items-center justify-between border-t pt-4 text-sm">
          <PreprintSource source={preprint.source} variant="inline" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Props for the PreprintCardSkeleton component.
 */
export interface PreprintCardSkeletonProps {
  /** Display variant */
  variant?: 'default' | 'compact' | 'featured';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for the PreprintCard component.
 *
 * @example
 * ```tsx
 * {isLoading ? <PreprintCardSkeleton /> : <PreprintCard preprint={data} />}
 * ```
 */
export function PreprintCardSkeleton({
  variant = 'default',
  className,
}: PreprintCardSkeletonProps) {
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
