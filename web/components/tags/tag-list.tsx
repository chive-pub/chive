'use client';

/**
 * Displays a list of tags in inline or wrap layout.
 *
 * @example
 * ```tsx
 * <TagList tags={tags} onTagClick={handleClick} layout="wrap" />
 * ```
 *
 * @packageDocumentation
 */

import { cn } from '@/lib/utils';
import type { TagSummary } from '@/lib/api/schema';
import { TagChip, TagChipSkeleton, type TagChipProps } from './tag-chip';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for TagList.
 */
export interface TagListProps {
  /** Tags to display */
  tags: Array<TagSummary | string>;

  /** Layout mode */
  layout?: 'inline' | 'wrap';

  /** Maximum tags to show (shows "+N more" for overflow) */
  limit?: number;

  /** Tag click handler */
  onTagClick?: (tag: TagSummary | string) => void;

  /** Tag remove handler (enables remove buttons) */
  onTagRemove?: (tag: TagSummary | string) => void;

  /** Size of tag chips */
  size?: TagChipProps['size'];

  /** Link tags to browse pages */
  linkToTags?: boolean;

  /** Show usage counts */
  showCounts?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Renders multiple tags.
 *
 * @param props - Component props
 * @returns Tag list element
 */
export function TagList({
  tags,
  layout = 'wrap',
  limit,
  onTagClick,
  onTagRemove,
  size = 'md',
  linkToTags = false,
  showCounts = false,
  className,
}: TagListProps) {
  if (tags.length === 0) {
    return null;
  }

  const displayTags = limit ? tags.slice(0, limit) : tags;
  const overflowCount = limit ? Math.max(0, tags.length - limit) : 0;

  const layoutClasses = {
    inline: 'flex items-center gap-1 overflow-x-auto',
    wrap: 'flex flex-wrap gap-1.5',
  };

  return (
    <div
      className={cn(layoutClasses[layout], className)}
      data-testid="tag-list"
      role="list"
      aria-label="Tags"
    >
      {displayTags.map((tag, _index) => {
        const key = typeof tag === 'string' ? tag : tag.normalizedForm;
        return (
          <div key={key} role="listitem">
            <TagChip
              tag={tag}
              size={size}
              onClick={onTagClick ? () => onTagClick(tag) : undefined}
              onRemove={onTagRemove ? () => onTagRemove(tag) : undefined}
              linkToTag={linkToTags && !onTagClick}
              showCount={showCounts}
            />
          </div>
        );
      })}

      {overflowCount > 0 && (
        <span
          className="text-sm text-muted-foreground px-1"
          title={`${overflowCount} more tag${overflowCount !== 1 ? 's' : ''}`}
        >
          +{overflowCount}
        </span>
      )}
    </div>
  );
}

/**
 * Loading skeleton for TagList.
 */
export function TagListSkeleton({
  count = 3,
  layout = 'wrap',
  size = 'md',
  className,
}: {
  count?: number;
  layout?: 'inline' | 'wrap';
  size?: TagChipProps['size'];
  className?: string;
}) {
  const layoutClasses = {
    inline: 'flex items-center gap-1',
    wrap: 'flex flex-wrap gap-1.5',
  };

  return (
    <div className={cn(layoutClasses[layout], className)} data-testid="tag-list-skeleton">
      {Array.from({ length: count }, (_, i) => (
        <TagChipSkeleton key={i} size={size} />
      ))}
    </div>
  );
}
