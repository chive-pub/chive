'use client';

/**
 * ReviewThread component for displaying threaded discussions.
 *
 * @remarks
 * Recursively renders review threads with unlimited nesting depth.
 * Features:
 * - Collapse/expand for deep threads
 * - Visual nesting indicators
 * - Reply action at each level
 *
 * @example
 * ```tsx
 * <ReviewThreadComponent
 *   thread={thread}
 *   onReply={handleReply}
 *   depth={0}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Review, FrontendReviewThread } from '@/lib/api/schema';
import type { DocumentFormat } from '@/lib/api/generated/types/pub/chive/defs';
import { ReviewCard } from './review-card';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the ReviewThreadComponent.
 */
export interface ReviewThreadProps {
  /** The thread to render */
  thread: FrontendReviewThread;

  /** Current nesting depth */
  depth?: number;

  /** Maximum depth before collapsing */
  maxExpandedDepth?: number;

  /** Callback when reply button is clicked */
  onReply?: (review: Review) => void;

  /** Callback when edit button is clicked */
  onEdit?: (review: Review) => void;

  /** Callback when delete button is clicked */
  onDelete?: (review: Review) => void;

  /** Callback when share button is clicked */
  onShare?: (review: Review) => void;

  /** Current user's DID for ownership checks */
  currentUserDid?: string;

  /** Whether to show target span excerpts */
  showTargets?: boolean;

  /** Document format for format-specific location display */
  documentFormat?: DocumentFormat;

  /** Callback when "Go to location" button is clicked on a review */
  onGoToLocation?: (uri: string) => void;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for the ThreadCollapseToggle component.
 */
export interface ThreadCollapseToggleProps {
  /** Whether the thread is collapsed */
  isCollapsed: boolean;

  /** Toggle callback */
  onToggle: () => void;

  /** Number of hidden replies */
  replyCount: number;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Toggle button for collapsing/expanding thread branches.
 */
export function ThreadCollapseToggle({
  isCollapsed,
  onToggle,
  replyCount,
  className,
}: ThreadCollapseToggleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground',
        className
      )}
      onClick={onToggle}
      aria-expanded={!isCollapsed}
      data-testid="thread-collapse-toggle"
    >
      {isCollapsed ? (
        <>
          <ChevronRight className="h-3 w-3" />
          <span>
            Show {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </span>
        </>
      ) : (
        <>
          <ChevronDown className="h-3 w-3" />
          <span>Hide replies</span>
        </>
      )}
    </Button>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Recursively renders a review thread with nested replies.
 *
 * @param props - Component props
 * @returns Thread element
 */
export function ReviewThreadComponent({
  thread,
  depth = 0,
  maxExpandedDepth = 3,
  onReply,
  onEdit,
  onDelete,
  onShare,
  currentUserDid,
  showTargets = true,
  documentFormat,
  onGoToLocation,
  className,
}: ReviewThreadProps) {
  // Auto-collapse deep threads
  const [isCollapsed, setIsCollapsed] = useState(depth >= maxExpandedDepth);

  const hasReplies = thread.replies && thread.replies.length > 0;
  // Normalize DIDs for comparison (trim whitespace, lowercase for consistency)
  const normalizedCurrentDid = currentUserDid?.toLowerCase().trim();
  const normalizedAuthorDid = thread.parent.author.did?.toLowerCase().trim();
  const isOwner = !!(
    normalizedCurrentDid &&
    normalizedAuthorDid &&
    normalizedCurrentDid === normalizedAuthorDid
  );

  return (
    <div className={cn('relative', className)} data-testid="review-thread" data-depth={depth}>
      {/* Parent review */}
      <ReviewCard
        review={thread.parent}
        variant={depth > 0 ? 'compact' : 'default'}
        depth={depth}
        onReply={onReply ? () => onReply(thread.parent) : undefined}
        onEdit={onEdit ? () => onEdit(thread.parent) : undefined}
        onDelete={onDelete ? () => onDelete(thread.parent) : undefined}
        onShare={onShare ? () => onShare(thread.parent) : undefined}
        isOwner={isOwner}
        showTarget={showTargets && depth === 0}
        documentFormat={documentFormat}
        onGoToLocation={onGoToLocation ? () => onGoToLocation(thread.parent.uri) : undefined}
      />

      {/* Replies */}
      {hasReplies && (
        <div className="mt-2 ml-4">
          {/* Collapse toggle for deep threads */}
          {thread.totalReplies > 0 && depth >= maxExpandedDepth - 1 && (
            <ThreadCollapseToggle
              isCollapsed={isCollapsed}
              onToggle={() => setIsCollapsed(!isCollapsed)}
              replyCount={thread.totalReplies}
            />
          )}

          {/* Nested replies */}
          {!isCollapsed && (
            <div className="space-y-2 border-l-2 border-muted pl-4">
              {thread.replies.map((reply) => (
                <ReviewThreadComponent
                  key={reply.parent.uri}
                  thread={reply}
                  depth={depth + 1}
                  maxExpandedDepth={maxExpandedDepth}
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onShare={onShare}
                  currentUserDid={currentUserDid}
                  showTargets={showTargets}
                  documentFormat={documentFormat}
                  onGoToLocation={onGoToLocation}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
