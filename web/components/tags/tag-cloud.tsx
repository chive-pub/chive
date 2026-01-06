'use client';

/**
 * Weighted tag cloud visualization.
 *
 * @example
 * ```tsx
 * <TagCloud tags={tags} onTagClick={handleClick} />
 * ```
 *
 * @packageDocumentation
 */

import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { TagSummary } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for TagCloud.
 */
export interface TagCloudProps {
  /** Tags with usage counts */
  tags: TagSummary[];

  /** Tag click handler */
  onTagClick?: (tag: TagSummary) => void;

  /** Link tags to browse pages */
  linkToTags?: boolean;

  /** Minimum font size in rem */
  minFontSize?: number;

  /** Maximum font size in rem */
  maxFontSize?: number;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculate font size based on tag weight relative to min/max in the set.
 */
function calculateFontSize(
  count: number,
  minCount: number,
  maxCount: number,
  minSize: number,
  maxSize: number
): number {
  if (maxCount === minCount) return (minSize + maxSize) / 2;

  const normalized = (count - minCount) / (maxCount - minCount);
  return minSize + normalized * (maxSize - minSize);
}

/**
 * Get color class based on tag weight.
 */
function getWeightClass(count: number, minCount: number, maxCount: number): string {
  if (maxCount === minCount) return 'text-foreground';

  const normalized = (count - minCount) / (maxCount - minCount);

  if (normalized > 0.8) return 'text-foreground font-semibold';
  if (normalized > 0.6) return 'text-foreground';
  if (normalized > 0.4) return 'text-foreground/90';
  if (normalized > 0.2) return 'text-muted-foreground';
  return 'text-muted-foreground/80';
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Displays tags in a cloud with weighted sizing.
 *
 * @param props - Component props
 * @returns Tag cloud element
 */
export function TagCloud({
  tags,
  onTagClick,
  linkToTags = false,
  minFontSize = 0.75,
  maxFontSize = 1.5,
  className,
}: TagCloudProps) {
  if (tags.length === 0) {
    return (
      <div
        className={cn('text-center text-muted-foreground py-4', className)}
        data-testid="tag-cloud-empty"
      >
        No tags yet
      </div>
    );
  }

  const counts = tags.map((t) => t.usageCount);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  // Shuffle tags for visual variety (seeded by first tag for consistency)
  const shuffled = [...tags].sort((a, b) => {
    const hashA =
      a.normalizedForm.charCodeAt(0) + a.normalizedForm.charCodeAt(a.normalizedForm.length - 1);
    const hashB =
      b.normalizedForm.charCodeAt(0) + b.normalizedForm.charCodeAt(b.normalizedForm.length - 1);
    return hashA - hashB;
  });

  return (
    <div
      className={cn('flex flex-wrap items-center justify-center gap-x-3 gap-y-2', className)}
      data-testid="tag-cloud"
      role="list"
      aria-label="Tag cloud"
    >
      {shuffled.map((tag) => {
        const fontSize = calculateFontSize(
          tag.usageCount,
          minCount,
          maxCount,
          minFontSize,
          maxFontSize
        );
        const weightClass = getWeightClass(tag.usageCount, minCount, maxCount);

        const tagElement = (
          <span
            className={cn(
              'inline-block transition-colors hover:text-primary cursor-pointer',
              weightClass
            )}
            style={{ fontSize: `${fontSize}rem` }}
            title={`${tag.displayForms[0] ?? tag.normalizedForm}: ${tag.usageCount} preprint${tag.usageCount !== 1 ? 's' : ''}`}
          >
            {tag.displayForms[0] ?? tag.normalizedForm}
          </span>
        );

        if (linkToTags && !onTagClick) {
          return (
            <Link
              key={tag.normalizedForm}
              href={`/tags/${encodeURIComponent(tag.normalizedForm)}`}
              role="listitem"
            >
              {tagElement}
            </Link>
          );
        }

        return (
          <div
            key={tag.normalizedForm}
            role="listitem"
            onClick={onTagClick ? () => onTagClick(tag) : undefined}
          >
            {tagElement}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Loading skeleton for TagCloud.
 */
export function TagCloudSkeleton({
  count = 15,
  className,
}: {
  count?: number;
  className?: string;
}) {
  // Generate varied widths for skeleton items
  const widths = Array.from({ length: count }, (_, i) => {
    const sizes = ['w-12', 'w-16', 'w-20', 'w-24', 'w-14', 'w-18'];
    return sizes[i % sizes.length];
  });

  return (
    <div
      className={cn('flex flex-wrap items-center justify-center gap-3', className)}
      data-testid="tag-cloud-skeleton"
    >
      {widths.map((width, i) => (
        <div key={i} className={cn('h-5 rounded bg-muted animate-pulse', width)} />
      ))}
    </div>
  );
}
