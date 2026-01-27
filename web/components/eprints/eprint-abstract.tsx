'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RichTextRenderer } from '@/components/editor/rich-text-renderer';
import { extractPlainText } from '@/lib/types/rich-text';
import type { RichTextItem } from '@/lib/types/rich-text';

/**
 * Props for the EprintAbstract component.
 */
export interface EprintAbstractProps {
  /** Rich text abstract items */
  abstractItems: RichTextItem[];
  /** Maximum characters to show when collapsed */
  maxLength?: number;
  /** Whether the abstract is initially expanded */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays an eprint abstract with expand/collapse functionality.
 *
 * @remarks
 * Client component that handles interactive expand/collapse.
 * Shows a truncated version by default with a button to expand.
 *
 * @example
 * ```tsx
 * <EprintAbstract
 *   abstractItems={eprint.abstractItems}
 *   maxLength={300}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the abstract
 */
export function EprintAbstract({
  abstractItems,
  maxLength = 300,
  defaultExpanded = false,
  className,
}: EprintAbstractProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Extract plain text for truncation calculation
  const plainText = extractPlainText(abstractItems);
  const needsTruncation = plainText.length > maxLength;

  return (
    <section role="region" aria-label="Abstract" className={cn('space-y-2', className)}>
      <div
        className={cn(
          'text-sm leading-relaxed text-muted-foreground',
          !isExpanded && needsTruncation && 'line-clamp-4'
        )}
      >
        <RichTextRenderer items={abstractItems} mode="block" />
      </div>

      {needsTruncation && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-auto p-0 text-xs text-primary hover:text-primary/80"
        >
          {isExpanded ? (
            <>
              Show less <ChevronUp className="ml-1 h-3 w-3" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="ml-1 h-3 w-3" />
            </>
          )}
        </Button>
      )}
    </section>
  );
}

/**
 * Props for the StaticAbstract component.
 */
export interface StaticAbstractProps {
  /** Rich text abstract items */
  abstractItems: RichTextItem[];
  /** Maximum lines to show (uses CSS line-clamp) */
  maxLines?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a static (non-expandable) truncated abstract.
 *
 * @remarks
 * For displaying abstracts in list views where expansion is not needed.
 * Uses CSS line-clamp for truncation to preserve rich text rendering.
 *
 * @example
 * ```tsx
 * <StaticAbstract abstractItems={eprint.abstractItems} maxLines={3} />
 * ```
 */
export function StaticAbstract({ abstractItems, maxLines = 3, className }: StaticAbstractProps) {
  return (
    <div
      className={cn('text-sm leading-relaxed text-muted-foreground', className)}
      style={{
        display: '-webkit-box',
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}
    >
      <RichTextRenderer items={abstractItems} mode="inline" />
    </div>
  );
}
