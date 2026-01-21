'use client';

/**
 * Overlay for displaying annotation highlights on PDF pages.
 *
 * @remarks
 * Renders highlight rectangles over the PDF text layer.
 * Each highlight is clickable to show the associated annotation.
 *
 * @example
 * ```tsx
 * <PDFAnnotationOverlay
 *   annotations={pageAnnotations}
 *   onAnnotationClick={handleClick}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useMemo } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Review, UnifiedTextSpanTarget } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Annotation highlight for rendering.
 */
export interface AnnotationHighlight {
  /** Annotation/review URI */
  uri: string;

  /** Target span */
  target: UnifiedTextSpanTarget;

  /** Display color */
  color: string;

  /** Excerpt for tooltip */
  excerpt: string;

  /** Number of replies */
  replyCount: number;

  /** Author name */
  authorName: string;
}

/**
 * Props for PDFAnnotationOverlay.
 */
export interface PDFAnnotationOverlayProps {
  /** Annotations to display */
  annotations: AnnotationHighlight[];

  /** Current page number (1-indexed) */
  pageNumber: number;

  /** Callback when annotation is clicked */
  onAnnotationClick?: (uri: string) => void;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const HIGHLIGHT_COLORS = {
  comment:
    'bg-yellow-200/50 hover:bg-yellow-200/70 dark:bg-yellow-500/30 dark:hover:bg-yellow-500/50',
  question: 'bg-blue-200/50 hover:bg-blue-200/70 dark:bg-blue-500/30 dark:hover:bg-blue-500/50',
  entity:
    'bg-purple-200/50 hover:bg-purple-200/70 dark:bg-purple-500/30 dark:hover:bg-purple-500/50',
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Single highlight element.
 */
function Highlight({
  annotation,
  onClick,
}: {
  annotation: AnnotationHighlight;
  onClick?: () => void;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'absolute cursor-pointer rounded-sm transition-colors',
              annotation.color || HIGHLIGHT_COLORS.comment
            )}
            style={{
              // Position would be calculated from text layer coordinates
              // For now, this is a placeholder structure
              left: 0,
              top: 0,
              width: '100%',
              height: '1.2em',
            }}
            onClick={onClick}
            aria-label={`Annotation by ${annotation.authorName}`}
            data-testid="annotation-highlight"
          />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium text-sm">{annotation.authorName}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{annotation.excerpt}</p>
          {annotation.replyCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {annotation.replyCount} {annotation.replyCount === 1 ? 'reply' : 'replies'}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Overlay layer for annotation highlights.
 *
 * @param props - Component props
 * @returns Overlay element
 */
export function PDFAnnotationOverlay({
  annotations,
  pageNumber,
  onAnnotationClick,
  className,
}: PDFAnnotationOverlayProps) {
  // Filter annotations for current page
  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.target.refinedBy?.pageNumber === pageNumber),
    [annotations, pageNumber]
  );

  if (pageAnnotations.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('absolute inset-0 pointer-events-none', className)}
      data-testid="pdf-annotation-overlay"
    >
      {/* Enable pointer events only on highlights */}
      <div className="relative w-full h-full [&>*]:pointer-events-auto">
        {pageAnnotations.map((annotation) => (
          <Highlight
            key={annotation.uri}
            annotation={annotation}
            onClick={() => onAnnotationClick?.(annotation.uri)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Convert reviews to annotation highlights.
 */
export function reviewsToHighlights(
  reviews: Review[],
  defaultColor: string = HIGHLIGHT_COLORS.comment
): AnnotationHighlight[] {
  return reviews
    .filter((review) => review.target)
    .map((review) => ({
      uri: review.uri,
      target: review.target!,
      color: defaultColor,
      excerpt: review.content.slice(0, 100),
      replyCount: 0,
      authorName: review.author.displayName || review.author.handle || 'Anonymous',
    }));
}
