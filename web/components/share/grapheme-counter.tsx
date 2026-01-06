'use client';

/**
 * Grapheme counter component for Bluesky post character limit.
 *
 * @remarks
 * Displays grapheme count with color-coded warning states.
 * Uses `unicode-segmenter` for accurate grapheme counting per UAX #29,
 * matching Bluesky's internal counting via `@atproto/lex-data`.
 */

import { cn } from '@/lib/utils';
import { countGraphemes } from '@/lib/bluesky';

/**
 * Grapheme counter props.
 */
interface GraphemeCounterProps {
  /** Text to count graphemes for */
  text: string;
  /** Maximum allowed graphemes (default: 300 for Bluesky) */
  max?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get the appropriate color class based on count.
 *
 * Color thresholds (for max=300):
 * - 0-250 (83%): Default muted text
 * - 251-280 (83-93%): Yellow warning
 * - 281-300 (93-100%): Orange caution
 * - >300: Red error
 */
function getCounterColorClass(count: number, max: number): string {
  const ratio = count / max;

  if (count > max) {
    return 'text-destructive font-medium';
  }
  if (ratio > 0.93) {
    return 'text-orange-500 dark:text-orange-400';
  }
  if (ratio > 0.83) {
    return 'text-yellow-600 dark:text-yellow-400';
  }
  return 'text-muted-foreground';
}

/**
 * Grapheme counter component.
 *
 * @example
 * ```tsx
 * <GraphemeCounter text={postText} max={300} />
 * // Displays: "245/300"
 * ```
 */
export function GraphemeCounter({ text, max = 300, className }: GraphemeCounterProps) {
  const count = countGraphemes(text);
  const colorClass = getCounterColorClass(count, max);

  return (
    <span
      className={cn('text-sm tabular-nums transition-colors', colorClass, className)}
      aria-label={`${count} of ${max} characters`}
      aria-live="polite"
    >
      {count}/{max}
    </span>
  );
}

/**
 * Check if text exceeds the character limit.
 *
 * @param text - Text to check
 * @param max - Maximum allowed graphemes
 * @returns True if text exceeds limit
 */
export function isOverLimit(text: string, max: number = 300): boolean {
  return countGraphemes(text) > max;
}
