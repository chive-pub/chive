import { Calendar, FileText, Tag } from 'lucide-react';

import { AuthorChipList } from './author-chip';
import { FieldBadgeList } from './field-badge';
import { PreprintMetrics } from './preprint-metrics';
import { LicenseBadge, DoiLink } from './preprint-metadata';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/format-date';
import type { Preprint, Author } from '@/lib/api/schema';

/**
 * Props for the PreprintHeader component.
 */
export interface PreprintHeaderProps {
  /** Preprint data */
  preprint: Preprint;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays the header section of a preprint detail page.
 *
 * @remarks
 * Server component that renders the title, authors, and key metadata
 * for a preprint detail page. Designed for the main content area.
 *
 * @example
 * ```tsx
 * <PreprintHeader preprint={preprintData} />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the preprint header
 */
export function PreprintHeader({ preprint, className }: PreprintHeaderProps) {
  const allAuthors: Author[] = [preprint.author, ...(preprint.coAuthors ?? [])];

  return (
    <header className={cn('space-y-6', className)}>
      {/* Version indicator */}
      {preprint.versions && preprint.versions.length > 1 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>Version {preprint.versions.length}</span>
          <span>·</span>
          <span>Last updated {formatDate(preprint.updatedAt ?? preprint.createdAt)}</span>
        </div>
      )}

      {/* Title */}
      <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
        {preprint.title}
      </h1>

      {/* Authors */}
      <div role="list" aria-label="Authors" className="flex flex-wrap items-center gap-4">
        <AuthorChipList authors={allAuthors} showAvatars />
      </div>

      {/* Date and metrics row */}
      <div className="flex flex-wrap items-center gap-4 border-y py-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Published {formatDate(preprint.createdAt)}</span>
        </div>

        {preprint.metrics && <PreprintMetrics metrics={preprint.metrics} size="sm" showAll />}
      </div>

      {/* Fields */}
      {preprint.fields && preprint.fields.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Fields:</span>
          <FieldBadgeList fields={preprint.fields} max={10} />
        </div>
      )}

      {/* Keywords */}
      {preprint.keywords && preprint.keywords.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Keywords:</span>
          <ul role="list" aria-label="Keywords" className="flex flex-wrap gap-1">
            {preprint.keywords.map((keyword: string) => (
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
        <LicenseBadge license={preprint.license} showName />
        {preprint.doi && <DoiLink doi={preprint.doi} showFull />}
      </div>
    </header>
  );
}

/**
 * Props for the PreprintHeaderSkeleton component.
 */
export interface PreprintHeaderSkeletonProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for the PreprintHeader component.
 *
 * @example
 * ```tsx
 * {isLoading ? <PreprintHeaderSkeleton /> : <PreprintHeader preprint={data} />}
 * ```
 */
export function PreprintHeaderSkeleton({ className }: PreprintHeaderSkeletonProps) {
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
 * Props for the CompactPreprintHeader component.
 */
export interface CompactPreprintHeaderProps {
  /** Preprint data */
  preprint: Preprint;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compact version of the header for secondary display contexts.
 *
 * @example
 * ```tsx
 * <CompactPreprintHeader preprint={preprintData} />
 * ```
 */
export function CompactPreprintHeader({ preprint, className }: CompactPreprintHeaderProps) {
  const allAuthors: Author[] = [preprint.author, ...(preprint.coAuthors ?? [])];

  return (
    <header className={cn('space-y-3', className)}>
      <h2 className="text-xl font-semibold leading-tight">{preprint.title}</h2>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {allAuthors.map((author, index) => (
          <span key={author.did}>
            {author.displayName ?? author.handle}
            {index < allAuthors.length - 1 && ', '}
          </span>
        ))}
        <span>·</span>
        <span>{formatDate(preprint.createdAt)}</span>
      </div>

      {preprint.fields && preprint.fields.length > 0 && (
        <FieldBadgeList fields={preprint.fields} max={3} variant="outline" />
      )}
    </header>
  );
}
