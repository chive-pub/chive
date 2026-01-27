import { Calendar, FileText, Tag } from 'lucide-react';

import { AuthorChipList, type EprintAuthor } from './author-chip';
import { FieldBadgeList } from './field-badge';
import { EprintMetrics } from './eprint-metrics';
import { LicenseBadge, DoiLink } from './eprint-metadata';
import { RichTextRenderer } from '@/components/editor/rich-text-renderer';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/format-date';
import type { Eprint } from '@/lib/api/schema';

/**
 * Props for the EprintHeader component.
 */
export interface EprintHeaderProps {
  /** Eprint data */
  eprint: Eprint;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays the header section of an eprint detail page.
 *
 * @remarks
 * Server component that renders the title, authors, and key metadata
 * for an eprint detail page. Designed for the main content area.
 *
 * @example
 * ```tsx
 * <EprintHeader eprint={eprintData} />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the eprint header
 */
export function EprintHeader({ eprint, className }: EprintHeaderProps) {
  return (
    <header className={cn('space-y-6', className)}>
      {/* Version indicator */}
      {eprint.versions && eprint.versions.length > 1 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>Version {eprint.versions.length}</span>
          <span>·</span>
          <span>Last updated {formatDate(eprint.updatedAt ?? eprint.createdAt)}</span>
        </div>
      )}

      {/* Title */}
      <h1 className="text-2xl font-bold leading-tight tracking-tight break-words md:text-4xl">
        <RichTextRenderer items={eprint.titleItems} mode="inline" />
      </h1>

      {/* Authors */}
      {eprint.authors && eprint.authors.length > 0 && (
        <div role="list" aria-label="Authors" className="flex flex-wrap items-center gap-4">
          <AuthorChipList authors={eprint.authors as EprintAuthor[]} showAvatars showBadges />
        </div>
      )}

      {/* Date and metrics row */}
      <div className="flex flex-wrap items-center gap-4 border-y py-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Published {formatDate(eprint.createdAt)}</span>
        </div>

        {eprint.metrics && <EprintMetrics metrics={eprint.metrics} size="sm" showAll />}
      </div>

      {/* Fields */}
      {eprint.fields && eprint.fields.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Fields:</span>
          <FieldBadgeList fields={eprint.fields} max={10} />
        </div>
      )}

      {/* Keywords */}
      {eprint.keywords && eprint.keywords.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Keywords:</span>
          <ul role="list" aria-label="Keywords" className="flex flex-wrap gap-1">
            {eprint.keywords.map((keyword: string) => (
              <li
                key={keyword}
                className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs"
              >
                <Tag className="mr-1 h-3 w-3" />
                {keyword}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* License and DOI */}
      <div
        role="region"
        aria-label="Metadata"
        className="flex flex-wrap items-center gap-6 text-sm"
      >
        <LicenseBadge license={eprint.license} showName />
        {eprint.doi && <DoiLink doi={eprint.doi} showFull />}
      </div>
    </header>
  );
}

/**
 * Props for the EprintHeaderSkeleton component.
 */
export interface EprintHeaderSkeletonProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for the EprintHeader component.
 *
 * @example
 * ```tsx
 * {isLoading ? <EprintHeaderSkeleton /> : <EprintHeader eprint={data} />}
 * ```
 */
export function EprintHeaderSkeleton({ className }: EprintHeaderSkeletonProps) {
  return (
    <header className={cn('space-y-6', className)}>
      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
        <div className="h-10 w-3/4 animate-pulse rounded bg-muted" />
      </div>

      {/* Authors skeleton */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-28 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Date row skeleton */}
      <div className="flex items-center gap-4 border-y py-4">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>

      {/* Fields skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-12 animate-pulse rounded bg-muted" />
        <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-5 w-28 animate-pulse rounded-full bg-muted" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
      </div>

      {/* License skeleton */}
      <div className="flex items-center gap-6">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
      </div>
    </header>
  );
}

/**
 * Props for the CompactEprintHeader component.
 */
export interface CompactEprintHeaderProps {
  /** Eprint data */
  eprint: Eprint;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compact version of the header for secondary display contexts.
 *
 * @example
 * ```tsx
 * <CompactEprintHeader eprint={eprintData} />
 * ```
 */
export function CompactEprintHeader({ eprint, className }: CompactEprintHeaderProps) {
  return (
    <header className={cn('space-y-3', className)}>
      <h2 className="text-xl font-semibold leading-tight">
        <RichTextRenderer items={eprint.titleItems} mode="inline" />
      </h2>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {eprint.authors.map((author, index) => (
          <span key={author.did ?? `author-${index}`}>
            {author.name ?? author.handle}
            {index < eprint.authors.length - 1 && ', '}
          </span>
        ))}
        <span>·</span>
        <span>{formatDate(eprint.createdAt)}</span>
      </div>

      {eprint.fields && eprint.fields.length > 0 && (
        <FieldBadgeList fields={eprint.fields} max={3} variant="outline" />
      )}
    </header>
  );
}
