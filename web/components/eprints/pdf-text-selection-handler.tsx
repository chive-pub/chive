'use client';

/**
 * Handles text selection in PDF text layer and generates W3C selectors.
 *
 * @remarks
 * Captures text selection from react-pdf's text layer and converts it
 * to W3C Web Annotation format (TextQuoteSelector + UnifiedTextPositionSelector).
 *
 * @example
 * ```tsx
 * <PDFTextSelectionHandler
 *   pageNumber={1}
 *   onSelect={handleTextSelect}
 * >
 *   <Page ... />
 * </PDFTextSelectionHandler>
 * ```
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useRef } from 'react';

import type { UnifiedTextSpanTarget, UnifiedTextPositionSelector } from '@/lib/api/schema';

/**
 * W3C Text Quote Selector for annotations.
 */
interface TextQuoteSelector {
  type: 'TextQuoteSelector';
  exact: string;
  prefix?: string;
  suffix?: string;
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for PDFTextSelectionHandler.
 */
export interface PDFTextSelectionHandlerProps {
  /** Current page number (1-indexed) */
  pageNumber: number;

  /** Eprint URI (source for target) */
  eprintUri: string;

  /** Callback when text is selected */
  onSelect: (target: UnifiedTextSpanTarget, selectedText: string) => void;

  /** Children (typically a Page component) */
  children: React.ReactNode;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract context around selection (prefix and suffix).
 */
function extractContext(
  container: HTMLElement,
  selection: Selection,
  contextLength: number = 32
): { prefix: string; suffix: string } {
  const fullText = container.textContent || '';
  const selectedText = selection.toString();
  const selectionIndex = fullText.indexOf(selectedText);

  if (selectionIndex === -1) {
    return { prefix: '', suffix: '' };
  }

  const prefix = fullText.slice(Math.max(0, selectionIndex - contextLength), selectionIndex).trim();
  const suffix = fullText
    .slice(
      selectionIndex + selectedText.length,
      selectionIndex + selectedText.length + contextLength
    )
    .trim();

  return { prefix, suffix };
}

/**
 * Calculate character offset within the page text.
 */
function calculateOffset(
  container: HTMLElement,
  selection: Selection
): { start: number; end: number } {
  const fullText = container.textContent || '';
  const selectedText = selection.toString();
  const startIndex = fullText.indexOf(selectedText);

  if (startIndex === -1) {
    return { start: 0, end: 0 };
  }

  return {
    start: startIndex,
    end: startIndex + selectedText.length,
  };
}

/**
 * Create W3C TextQuoteSelector.
 */
function createQuoteSelector(text: string, prefix: string, suffix: string): TextQuoteSelector {
  return {
    type: 'TextQuoteSelector',
    exact: text,
    prefix: prefix || undefined,
    suffix: suffix || undefined,
  };
}

/**
 * Create W3C UnifiedTextPositionSelector.
 */
function createPositionSelector(
  start: number,
  end: number,
  pageNumber: number
): UnifiedTextPositionSelector {
  return {
    type: 'TextPositionSelector',
    start,
    end,
    pageNumber,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Wraps PDF Page to capture text selection.
 *
 * @param props - Component props
 * @returns Wrapper element
 */
export function PDFTextSelectionHandler({
  pageNumber,
  eprintUri,
  onSelect,
  children,
  className,
}: PDFTextSelectionHandlerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 3) {
      return;
    }

    // Find the text layer within the container
    const textLayer = containerRef.current.querySelector('.react-pdf__Page__textContent');
    if (!textLayer) {
      return;
    }

    // Extract context
    const { prefix, suffix } = extractContext(textLayer as HTMLElement, selection);

    // Calculate offsets
    const { start, end } = calculateOffset(textLayer as HTMLElement, selection);

    // Create W3C selectors
    const quoteSelector = createQuoteSelector(selectedText, prefix, suffix);
    const positionSelector = createPositionSelector(start, end, pageNumber);

    // Create target
    const target: UnifiedTextSpanTarget = {
      source: eprintUri,
      selector: quoteSelector,
      refinedBy: positionSelector,
    };

    onSelect(target, selectedText);
  }, [pageNumber, eprintUri, onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseUp]);

  return (
    <div ref={containerRef} className={className} data-testid="pdf-text-selection-handler">
      {children}
    </div>
  );
}
