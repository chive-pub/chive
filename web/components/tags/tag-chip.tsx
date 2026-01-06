'use client';

/**
 * Tag chip for displaying a single user tag.
 *
 * @example
 * ```tsx
 * <TagChip tag={tag} onRemove={() => handleRemove(tag)} />
 * ```
 *
 * @packageDocumentation
 */

import Link from 'next/link';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TagSummary } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for TagChip.
 */
export interface TagChipProps {
  /** Tag to display */
  tag: TagSummary | string;

  /** Click handler */
  onClick?: () => void;

  /** Remove handler (shows X button when provided) */
  onRemove?: () => void;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Link to tag browse page */
  linkToTag?: boolean;

  /** Show usage count */
  showCount?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const SIZE_CLASSES = {
  sm: 'h-5 px-1.5 text-xs gap-1',
  md: 'h-6 px-2 text-sm gap-1.5',
  lg: 'h-8 px-3 text-base gap-2',
};

function getTagDisplay(tag: TagSummary | string): string {
  return typeof tag === 'string' ? tag : (tag.displayForms[0] ?? tag.normalizedForm);
}

function getTagNormalized(tag: TagSummary | string): string {
  return typeof tag === 'string' ? tag.toLowerCase().replace(/\s+/g, '-') : tag.normalizedForm;
}

function getTagCount(tag: TagSummary | string): number | undefined {
  return typeof tag === 'string' ? undefined : tag.usageCount;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Displays a single tag as a clickable chip.
 *
 * @param props - Component props
 * @returns Tag chip element
 */
export function TagChip({
  tag,
  onClick,
  onRemove,
  size = 'md',
  linkToTag = false,
  showCount = false,
  className,
}: TagChipProps) {
  const display = getTagDisplay(tag);
  const normalized = getTagNormalized(tag);
  const count = getTagCount(tag);

  const chipContent = (
    <>
      <span className="truncate max-w-[150px]">{display}</span>
      {showCount && count !== undefined && (
        <span className="text-muted-foreground tabular-nums">({count})</span>
      )}
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-4 w-4 p-0 hover:bg-destructive/20"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${display} tag`}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </>
  );

  const badgeClasses = cn(
    'inline-flex items-center font-normal',
    SIZE_CLASSES[size],
    (onClick || linkToTag) && 'cursor-pointer hover:bg-secondary/80',
    className
  );

  // Link variant
  if (linkToTag) {
    return (
      <Link href={`/tags/${encodeURIComponent(normalized)}`}>
        <Badge variant="secondary" className={badgeClasses} data-testid="tag-chip">
          {chipContent}
        </Badge>
      </Link>
    );
  }

  // Clickable variant
  if (onClick) {
    return (
      <Badge variant="secondary" className={badgeClasses} onClick={onClick} data-testid="tag-chip">
        {chipContent}
      </Badge>
    );
  }

  // Static variant
  return (
    <Badge variant="secondary" className={badgeClasses} data-testid="tag-chip">
      {chipContent}
    </Badge>
  );
}

/**
 * Tag chip with quality/spam indicator.
 */
export function TagChipWithQuality({
  tag,
  showQuality = false,
  ...props
}: TagChipProps & {
  showQuality?: boolean;
}) {
  if (typeof tag === 'string' || !showQuality) {
    return <TagChip tag={tag} {...props} />;
  }

  // qualityScore is 0-1 where 1 is high quality
  const qualityColor =
    tag.qualityScore > 0.7
      ? 'border-green-500/50'
      : tag.qualityScore > 0.3
        ? 'border-yellow-500/50'
        : 'border-red-500/50';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-block">
            <TagChip tag={tag} {...props} className={cn('border', qualityColor, props.className)} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Quality: {(tag.qualityScore * 100).toFixed(0)}%</p>
          <p className="text-xs text-muted-foreground">
            {tag.usageCount} use{tag.usageCount !== 1 ? 's' : ''}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Loading skeleton for TagChip.
 */
export function TagChipSkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const widthClasses = {
    sm: 'w-12',
    md: 'w-16',
    lg: 'w-20',
  };

  return (
    <div
      className={cn('animate-pulse rounded-full bg-muted', SIZE_CLASSES[size], widthClasses[size])}
      data-testid="tag-chip-skeleton"
    />
  );
}
