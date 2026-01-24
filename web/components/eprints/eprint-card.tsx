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
import type { EprintCardData, EprintAuthor, FieldRef, TrendingEntry } from '@/lib/api/schema';

/**
 * Type guard to check if eprint has TrendingEntry shape (rich data).
 */
function isTrendingEntry(eprint: EprintCardData): eprint is TrendingEntry {
  return 'createdAt' in eprint && 'source' in eprint;
}

/**
 * Extracts authors in EprintAuthor format from card data.
 */
function getAuthors(eprint: EprintCardData): EprintAuthor[] {
  if (!eprint.authors || eprint.authors.length === 0) {
    return [];
  }

  // TrendingEntry has richer author data
  if (isTrendingEntry(eprint)) {
    return eprint.authors.map((a) => ({
      did: a.did,
      name: a.name,
      handle: a.handle,
      avatar: a.avatarUrl,
      orcid: a.orcid,
      order: a.order,
      affiliations: a.affiliations?.map((aff) => ({
        name: aff.name,
        rorId: aff.rorId,
        department: aff.department,
      })),
      contributions: a.contributions?.map((c) => ({
        typeUri: c.typeUri,
        typeSlug: c.typeId,
        degreeSlug: c.degree ?? 'equal',
      })),
      isCorrespondingAuthor: a.isCorrespondingAuthor ?? false,
      isHighlighted: a.isHighlighted ?? false,
    }));
  }

  // EprintSummary or EnrichedSearchHit has lean author refs
  return eprint.authors.map(
    (a: { did?: string; handle?: string; displayName?: string; name?: string }, idx: number) => ({
      did: a.did ?? '',
      name: a.name ?? a.displayName ?? a.handle ?? 'Unknown',
      handle: a.handle,
      order: idx + 1,
      isCorrespondingAuthor: false,
      isHighlighted: false,
    })
  );
}

/**
 * Extracts fields in FieldRef format from card data.
 */
function getFields(eprint: EprintCardData): FieldRef[] {
  if (!eprint.fields || eprint.fields.length === 0) {
    return [];
  }

  // TrendingEntry has full field refs
  if (isTrendingEntry(eprint)) {
    return eprint.fields.map((f) => ({
      id: f.id ?? f.uri,
      uri: f.uri,
      label: f.label,
      kind: 'type' as const,
      subkind: undefined,
      status: 'established' as const,
      createdAt: new Date().toISOString(),
    }));
  }

  // EprintSummary now has field refs with uri and label
  return eprint.fields.map((f) => ({
    id: f.id ?? f.uri,
    uri: f.uri,
    label: f.label,
    kind: 'type' as const,
    subkind: undefined,
    status: 'established' as const,
    createdAt: new Date().toISOString(),
  }));
}

/**
 * Gets the display date from card data.
 */
function getDisplayDate(eprint: EprintCardData): string {
  if ('createdAt' in eprint && eprint.createdAt) {
    return eprint.createdAt;
  }
  if ('publishedAt' in eprint && eprint.publishedAt) {
    return eprint.publishedAt;
  }
  return eprint.indexedAt;
}

/**
 * Props for the EprintCard component.
 */
export interface EprintCardProps {
  /** Eprint data (can be TrendingEntry or EprintSummary) */
  eprint: EprintCardData;
  /** Optional callback for prefetching on hover */
  onPrefetch?: (uri: string) => void;
  /** Display variant */
  variant?: 'default' | 'compact' | 'featured';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays an eprint card with title, authors, and metadata.
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

  const authors = getAuthors(eprint);
  const fields = getFields(eprint);
  const displayDate = getDisplayDate(eprint);
  const source = isTrendingEntry(eprint) ? eprint.source : undefined;

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
              {authors.length > 0 && (
                <AuthorChipList authors={authors} max={3} size="sm" showBadges={false} />
              )}
              <span className="text-xs text-muted-foreground">
                {formatDate(displayDate, { relative: true })}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <StaticAbstract abstract={eprint.abstract ?? ''} maxLength={200} />

        {fields.length > 0 && <FieldBadgeList fields={fields} max={3} />}

        {source && (
          <div className="flex items-center justify-between pt-2 text-xs">
            <EprintSource source={source} variant="inline" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Props for the CompactEprintCard component.
 */
interface CompactEprintCardProps {
  eprint: EprintCardData;
  className?: string;
}

/**
 * Compact version of the eprint card for dense list views.
 */
function CompactEprintCard({ eprint, className }: CompactEprintCardProps) {
  const eprintUrl = `/eprints/${encodeURIComponent(eprint.uri)}`;
  const authors = getAuthors(eprint);
  const fields = getFields(eprint);
  const displayDate = getDisplayDate(eprint);

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
          <span>{authors[0]?.name ?? 'Unknown'}</span>
          <span>·</span>
          <span>{formatDate(displayDate, { relative: true })}</span>
        </div>
      </div>
      {fields.length > 0 && <FieldBadgeList fields={fields} max={1} variant="outline" />}
    </div>
  );
}

/**
 * Props for the FeaturedEprintCard component.
 */
interface FeaturedEprintCardProps {
  eprint: EprintCardData;
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
  const authors = getAuthors(eprint);
  const fields = getFields(eprint);
  const displayDate = getDisplayDate(eprint);
  const source = isTrendingEntry(eprint) ? eprint.source : undefined;

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
          {authors.length > 0 && <AuthorChipList authors={authors} max={5} showBadges />}
          <span className="text-sm text-muted-foreground">{formatDate(displayDate)}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <StaticAbstract abstract={eprint.abstract ?? ''} maxLength={300} />

        {fields.length > 0 && <FieldBadgeList fields={fields} max={5} />}

        {source && (
          <div className="flex items-center justify-between border-t pt-4 text-sm">
            <EprintSource source={source} variant="inline" />
          </div>
        )}
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
