'use client';

/**
 * Clamps long prose to a few lines, with a control to reveal the rest.
 *
 * @remarks
 * A profile bio has no length limit worth relying on, and a long one pushed
 * everything below it — affiliations, identifiers, the eprint list — off the
 * screen. This shows the opening and lets the reader ask for the rest.
 *
 * The control appears only when the text is actually clipped. Rendering a
 * "Show more" beside three lines that were never truncated is worse than not
 * having one, and whether a given bio overflows depends on the viewport, so it
 * is measured rather than guessed from a character count: the clamped element
 * is checked for `scrollHeight > clientHeight`, and re-checked when the
 * element resizes.
 *
 * It wraps arbitrary children rather than taking a string, because the bio is
 * rich text — links, mentions, LaTeX — and clamping is a layout concern that
 * should not care what it is clamping.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Props for {@link ExpandableProse}.
 *
 * @public
 */
export interface ExpandableProseProps {
  /** The prose to clamp */
  children: React.ReactNode;
  /** Lines to show when collapsed */
  lines?: 3 | 4 | 5 | 6;
  /** Additional class names for the prose container */
  className?: string;
}

/**
 * Tailwind generates these from the literal class names, so they cannot be
 * built by interpolation.
 */
const CLAMP: Record<number, string> = {
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
};

/**
 * Shows the first few lines of some prose, with a toggle for the rest.
 *
 * @param props - Component props
 * @returns The prose, clamped when it is long enough to need it
 *
 * @public
 */
export function ExpandableProse({ children, lines = 4, className }: ExpandableProseProps) {
  const [expanded, setExpanded] = useState(false);
  const [isClipped, setIsClipped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const contentId = useId();

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Only meaningful while clamped: expanded, scrollHeight equals clientHeight
    // and every bio would look un-clipped.
    if (expanded) return;
    setIsClipped(el.scrollHeight > el.clientHeight + 1);
  }, [expanded]);

  useEffect(() => {
    measure();

    // A bio that fits on a wide window clips on a narrow one, and the profile
    // header reflows at `sm`. Without this the control would be decided once,
    // at whatever width the page happened to load at.
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [measure, children]);

  return (
    <div className="space-y-1">
      <div ref={ref} id={contentId} className={cn(!expanded && CLAMP[lines], className)}>
        {children}
      </div>

      {(isClipped || expanded) && (
        <button
          type="button"
          onClick={() => {
            setExpanded((value) => !value);
          }}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
