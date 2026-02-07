'use client';

/**
 * ReviewCard component for displaying a single peer review.
 *
 * @remarks
 * Displays a review with:
 * - Reviewer avatar, name, and timestamp
 * - Review content (plain text or rich text with references)
 * - Target span excerpt (for inline annotations)
 * - Motivation indicator (commenting, questioning, etc.)
 * - Action buttons (reply, edit, delete)
 *
 * Supports two variants:
 * - `default`: Full-width card with all details
 * - `compact`: Condensed view for nested replies
 *
 * @example
 * ```tsx
 * <ReviewCard
 *   review={review}
 *   onReply={() => setReplyTo(review)}
 *   variant="default"
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  HelpCircle,
  Reply,
  MoreVertical,
  Pencil,
  Trash2,
  Share2,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatRelativeDate } from '@/lib/utils/format-date';
import { RichTextRenderer } from '@/components/editor/rich-text-renderer';
import { DocumentLocationCard } from './document-location-card';
import type { Review, AnnotationMotivation } from '@/lib/api/schema';
import type { DocumentFormat } from '@/lib/api/generated/types/pub/chive/defs';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the ReviewCard component.
 */
export interface ReviewCardProps {
  /** The review to display */
  review: Review;

  /** Display variant */
  variant?: 'default' | 'compact';

  /** Nesting depth for threaded replies */
  depth?: number;

  /** Callback when reply button is clicked */
  onReply?: () => void;

  /** Callback when edit button is clicked */
  onEdit?: () => void;

  /** Callback when delete button is clicked */
  onDelete?: () => void;

  /** Callback when share button is clicked */
  onShare?: () => void;

  /** Whether the current user owns this review */
  isOwner?: boolean;

  /** Whether to show the target span excerpt */
  showTarget?: boolean;

  /** Document format for format-specific location display */
  documentFormat?: DocumentFormat;

  /** Callback when "Go to location" button is clicked */
  onGoToLocation?: () => void;

  /** Whether to show a thumbnail preview (PDF only) */
  showThumbnail?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Known motivation values - used to narrow the open union.
 */
const KNOWN_MOTIVATIONS: readonly AnnotationMotivation[] = [
  'commenting',
  'highlighting',
  'questioning',
  'replying',
  'assessing',
  'bookmarking',
  'classifying',
  'describing',
  'editing',
  'linking',
  'moderating',
  'tagging',
] as const;

/**
 * Type guard to check if a string is a known motivation.
 */
function isKnownMotivation(motivation: string): motivation is AnnotationMotivation {
  return KNOWN_MOTIVATIONS.includes(motivation as AnnotationMotivation);
}

/**
 * Gets the icon for a motivation type.
 */
function getMotivationIcon(motivation?: string) {
  if (!motivation || !isKnownMotivation(motivation)) {
    return <MessageSquare className="h-3 w-3" />;
  }
  switch (motivation) {
    case 'questioning':
      return <HelpCircle className="h-3 w-3" />;
    case 'replying':
      return <Reply className="h-3 w-3" />;
    default:
      return <MessageSquare className="h-3 w-3" />;
  }
}

/**
 * Gets the label for a motivation type.
 */
function getMotivationLabel(motivation?: string): string {
  if (!motivation) return 'Comment';
  if (!isKnownMotivation(motivation)) return motivation; // Return unknown value as-is
  switch (motivation) {
    case 'commenting':
      return 'Comment';
    case 'questioning':
      return 'Question';
    case 'replying':
      return 'Reply';
    case 'highlighting':
      return 'Highlight';
    case 'linking':
      return 'Link';
    case 'classifying':
      return 'Classification';
    case 'describing':
      return 'Description';
    case 'assessing':
      return 'Assessment';
    default:
      return 'Comment';
  }
}

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
// COMPONENT
// =============================================================================

/**
 * Displays a single peer review.
 *
 * @remarks
 * If the review is deleted (soft-delete tombstone), shows a placeholder
 * message instead of the content. This preserves thread structure.
 *
 * @param props - Component props
 * @returns Review card element
 */
export function ReviewCard({
  review,
  variant = 'default',
  depth = 0,
  onReply,
  onEdit,
  onDelete,
  onShare,
  isOwner = false,
  showTarget = true,
  documentFormat,
  onGoToLocation,
  showThumbnail = false,
  className,
}: ReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isCompact = variant === 'compact';
  const hasTarget = !!review.target;
  const isDeleted = review.deleted === true;

  // Use line-clamp for truncation instead of string slicing
  const showFullContent = isCompact || isExpanded;

  // Render tombstone for deleted reviews
  if (isDeleted) {
    return (
      <article
        className={cn(
          'group relative',
          isCompact ? 'py-3' : 'rounded-lg border border-dashed bg-muted/30 p-4',
          className
        )}
        data-testid="review-card-deleted"
        data-review-uri={review.uri}
      >
        <div className="text-muted-foreground italic">This comment has been deleted</div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        'group relative',
        isCompact ? 'py-3' : 'rounded-lg border bg-card p-4',
        className
      )}
      data-testid="review-card"
      data-review-uri={review.uri}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/authors/${encodeURIComponent(review.author.did)}`} className="shrink-0">
            <Avatar className={cn(isCompact ? 'h-6 w-6' : 'h-8 w-8')}>
              <AvatarImage src={review.author.avatar} alt={review.author.displayName} />
              <AvatarFallback className="text-xs">
                {getInitials(review.author.displayName)}
              </AvatarFallback>
            </Avatar>
          </Link>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Link
                href={`/authors/${encodeURIComponent(review.author.did)}`}
                className={cn('font-medium hover:underline', isCompact ? 'text-sm' : 'text-base')}
              >
                {review.author.displayName || review.author.handle || 'Anonymous'}
              </Link>

              {review.motivation && review.motivation !== 'commenting' && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  {getMotivationIcon(review.motivation)}
                  <span>{getMotivationLabel(review.motivation)}</span>
                </Badge>
              )}
            </div>

            <time
              dateTime={review.createdAt}
              className="text-xs text-muted-foreground"
              title={new Date(review.createdAt).toLocaleString()}
            >
              {formatRelativeDate(review.createdAt)}
              {review.indexedAt && review.indexedAt !== review.createdAt && (
                <span className="ml-1">(edited)</span>
              )}
            </time>
          </div>
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Review actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onReply && (
              <DropdownMenuItem onClick={onReply}>
                <Reply className="mr-2 h-4 w-4" />
                Reply
              </DropdownMenuItem>
            )}
            {onShare && (
              <DropdownMenuItem onClick={onShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </DropdownMenuItem>
            )}
            {isOwner && onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {isOwner && onDelete && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Target span excerpt with document location */}
      {showTarget && hasTarget && review.target?.selector && (
        <div className="mt-3">
          <DocumentLocationCard
            target={review.target}
            documentFormat={documentFormat}
            onGoToLocation={onGoToLocation}
            showThumbnail={showThumbnail}
          />
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          'mt-3',
          isCompact ? 'text-sm' : 'text-base',
          !showFullContent && 'line-clamp-6'
        )}
      >
        <RichTextRenderer
          text={review.body?.text ?? review.content}
          facets={review.body?.facets}
          mode="block"
        />
      </div>

      {!showFullContent && (
        <Button variant="link" className="h-auto p-0 text-sm" onClick={() => setIsExpanded(true)}>
          Read more
        </Button>
      )}

      {/* Quick reply button (inline, not in dropdown) */}
      {onReply && (
        <div className={cn('flex items-center gap-2', isCompact ? 'mt-2' : 'mt-3')}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'gap-1 text-muted-foreground hover:text-foreground',
              isCompact ? 'h-6 text-xs px-2' : 'h-8 text-xs'
            )}
            onClick={onReply}
          >
            <Reply className="h-3 w-3" />
            Reply
          </Button>
        </div>
      )}
    </article>
  );
}

/**
 * Skeleton loading state for ReviewCard.
 */
export function ReviewCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn('animate-pulse', isCompact ? 'py-3' : 'rounded-lg border bg-card p-4')}
      data-testid="review-card-skeleton"
    >
      <div className="flex items-center gap-3">
        <div className={cn('rounded-full bg-muted', isCompact ? 'h-6 w-6' : 'h-8 w-8')} />
        <div className="space-y-1">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
      </div>
    </div>
  );
}
