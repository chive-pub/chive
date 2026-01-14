'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Props for the EprintAbstract component.
 */
export interface EprintAbstractProps {
  /** The abstract text */
  abstract: string;
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
 *   abstract={eprint.abstract}
 *   maxLength={300}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the abstract
 */
export function EprintAbstract({
  abstract,
  maxLength = 300,
  defaultExpanded = false,
  className,
}: EprintAbstractProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const needsTruncation = abstract.length > maxLength;
  const displayText = isExpanded || !needsTruncation ? abstract : truncateText(abstract, maxLength);

  return (
    <section role="region" aria-label="Abstract" className={cn('space-y-2', className)}>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {displayText}
        {!isExpanded && needsTruncation && '...'}
      </p>

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
 * Truncates text at a word boundary.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  // Find the last space before maxLength
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace);
  }

  return truncated;
}

/**
 * Props for the StaticAbstract component.
 */
export interface StaticAbstractProps {
  /** The abstract text */
  abstract: string;
  /** Maximum characters to show */
  maxLength?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a static (non-expandable) truncated abstract.
 *
 * @remarks
 * Server component for displaying abstracts in list views
 * where expansion is not needed.
 *
 * @example
 * ```tsx
 * <StaticAbstract abstract={eprint.abstract} maxLength={200} />
 * ```
 */
export function StaticAbstract({ abstract, maxLength = 200, className }: StaticAbstractProps) {
  const displayText =
    abstract.length > maxLength ? truncateText(abstract, maxLength) + '...' : abstract;

  return (
    <p className={cn('text-sm leading-relaxed text-muted-foreground', className)}>{displayText}</p>
  );
}
