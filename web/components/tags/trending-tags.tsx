'use client';

/**
 * Trending tags panel.
 *
 * @example
 * ```tsx
 * <TrendingTags limit={10} timeWindow="week" />
 * ```
 *
 * @packageDocumentation
 */

import { TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTrendingTags } from '@/lib/hooks/use-tags';
import type { TagSummary } from '@/lib/api/schema';
import { TagList, TagListSkeleton } from './tag-list';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for TrendingTags.
 */
export interface TrendingTagsProps {
  /** Maximum tags to show */
  limit?: number;

  /** Time window for trending calculation */
  timeWindow?: 'day' | 'week' | 'month';

  /** Tag click handler */
  onTagClick?: (tag: string) => void;

  /** Link tags to browse pages */
  linkToTags?: boolean;

  /** Show as card or inline */
  variant?: 'card' | 'inline';

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Displays trending tags.
 *
 * @param props - Component props
 * @returns Trending tags element
 */
export function TrendingTags({
  limit = 10,
  timeWindow = 'week',
  onTagClick,
  linkToTags = true,
  variant = 'card',
  className,
}: TrendingTagsProps) {
  const { data, isLoading, error } = useTrendingTags(timeWindow);

  // API does not support limit param; apply client-side limiting.
  const tags = (data?.tags ?? []).slice(0, limit);

  // Wrap onTagClick to normalize TagSummary to string
  const handleTagClick = onTagClick
    ? (tag: string | TagSummary) => {
        const normalizedForm = typeof tag === 'string' ? tag : tag.normalizedForm;
        onTagClick(normalizedForm);
      }
    : undefined;

  // Inline variant: just the tag list.
  if (variant === 'inline') {
    if (isLoading) {
      return <TagListSkeleton count={limit} layout="wrap" size="sm" className={className} />;
    }

    if (error || tags.length === 0) {
      return null;
    }

    return (
      <TagList
        tags={tags}
        layout="wrap"
        size="sm"
        onTagClick={handleTagClick}
        linkToTags={linkToTags && !onTagClick}
        className={className}
      />
    );
  }

  // Card variant
  return (
    <Card className={cn('', className)} data-testid="trending-tags">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Trending tags
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <TagListSkeleton count={limit} layout="wrap" />
        ) : error ? (
          <p className="text-sm text-muted-foreground">Failed to load tags</p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trending tags</p>
        ) : (
          <TagList
            tags={tags}
            layout="wrap"
            onTagClick={handleTagClick}
            linkToTags={linkToTags && !onTagClick}
            showCounts
          />
        )}
      </CardContent>
    </Card>
  );
}
