'use client';

/**
 * Popover that appears when text is selected in PDF.
 *
 * @remarks
 * Shows action buttons for:
 * - Adding a review/annotation
 * - Linking to an entity (Wikidata, authority)
 * - Highlighting the text
 *
 * @example
 * ```tsx
 * <PDFSelectionPopover
 *   selectedText="neural networks"
 *   target={target}
 *   position={{ x: 100, y: 200 }}
 *   onAddReview={handleAddReview}
 *   onLinkEntity={handleLinkEntity}
 *   onClose={handleClose}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { MessageSquare, Link2, Highlighter, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TextSpanTarget } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for PDFSelectionPopover.
 */
export interface PDFSelectionPopoverProps {
  /** The selected text */
  selectedText: string;

  /** W3C target for the selection */
  target: TextSpanTarget;

  /** Position for the popover */
  position: { x: number; y: number };

  /** Callback to add a review */
  onAddReview: (target: TextSpanTarget) => void;

  /** Callback to link to entity */
  onLinkEntity: (target: TextSpanTarget, selectedText: string) => void;

  /** Callback to highlight (without annotation) */
  onHighlight?: (target: TextSpanTarget) => void;

  /** Callback to close the popover */
  onClose: () => void;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Action popover for text selection.
 *
 * @param props - Component props
 * @returns Popover element
 */
export function PDFSelectionPopover({
  selectedText,
  target,
  position,
  onAddReview,
  onLinkEntity,
  onHighlight,
  onClose,
  className,
}: PDFSelectionPopoverProps) {
  // Truncate long selections for display
  const displayText = selectedText.length > 50 ? selectedText.slice(0, 50) + '...' : selectedText;

  return (
    <div
      className={cn(
        'absolute z-50 flex flex-col rounded-lg border bg-popover p-2 shadow-lg',
        className
      )}
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%)',
      }}
      data-testid="pdf-selection-popover"
    >
      {/* Selected text preview */}
      <div className="flex items-start gap-2 mb-2 max-w-xs">
        <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
          &quot;{displayText}&quot;
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => onAddReview(target)}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Comment
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => onLinkEntity(target, selectedText)}
        >
          <Link2 className="h-3.5 w-3.5" />
          Link
        </Button>

        {onHighlight && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => onHighlight(target)}
          >
            <Highlighter className="h-3.5 w-3.5" />
            Highlight
          </Button>
        )}
      </div>
    </div>
  );
}
