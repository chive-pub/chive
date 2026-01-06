/**
 * Mock for react-pdf-highlighter-extended for testing.
 *
 * @remarks
 * This mock provides simplified implementations of the PDF highlighter
 * components that can be used in unit tests without requiring actual
 * PDF rendering.
 */

import React, { type ReactNode, type CSSProperties } from 'react';
import { vi } from 'vitest';

// =============================================================================
// TYPES (simplified for mocking)
// =============================================================================

export interface Highlight {
  id: string;
  type?: 'text' | 'area';
  position: ScaledPosition;
  [key: string]: unknown;
}

export interface GhostHighlight {
  position: ScaledPosition;
}

export interface ScaledPosition {
  boundingRect: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
    pageNumber: number;
  };
  rects: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
    pageNumber: number;
  }>;
}

export interface PdfSelection {
  content: {
    text?: string;
    image?: string;
  };
  position: ScaledPosition;
  makeGhostHighlight: () => GhostHighlight;
}

export interface PdfHighlighterUtils {
  scrollToHighlight: (highlight: Highlight) => void;
  setTip: (tip: ReactNode | null) => void;
}

export type ViewportHighlight<T> = T & { position: ScaledPosition };

// =============================================================================
// MOCK UTILITIES
// =============================================================================

export const mockHighlighterUtils: PdfHighlighterUtils = {
  scrollToHighlight: vi.fn(),
  setTip: vi.fn(),
};

// Reset mock between tests
export function resetMockHighlighterUtils() {
  vi.mocked(mockHighlighterUtils.scrollToHighlight).mockClear();
  vi.mocked(mockHighlighterUtils.setTip).mockClear();
}

// =============================================================================
// MOCK COMPONENTS
// =============================================================================

interface PdfLoaderProps {
  document: string;
  beforeLoad?: () => ReactNode;
  errorMessage?: (error: Error) => ReactNode;
  children: (pdfDocument: unknown) => ReactNode;
}

export function PdfLoader({ document, children }: PdfLoaderProps) {
  return (
    <div data-testid="pdf-loader" data-document={document}>
      {children({ numPages: 5 })}
    </div>
  );
}

interface PdfHighlighterProps<T extends Highlight> {
  pdfDocument: unknown;
  highlights: T[];
  pdfScaleValue?: number;
  enableAreaSelection?: (event: MouseEvent) => boolean;
  onSelection?: (selection: PdfSelection) => void;
  selectionTip?: ReactNode;
  utilsRef?: (utils: PdfHighlighterUtils) => void;
  style?: CSSProperties;
  children?: ReactNode;
}

export function PdfHighlighter<T extends Highlight>({
  highlights,
  pdfScaleValue = 1,
  selectionTip,
  utilsRef,
  style,
  children,
}: PdfHighlighterProps<T>) {
  // Register utils ref on mount
  React.useEffect(() => {
    if (utilsRef) {
      utilsRef(mockHighlighterUtils);
    }
  }, [utilsRef]);

  return (
    <div
      data-testid="pdf-highlighter"
      data-scale={pdfScaleValue}
      data-highlight-count={highlights.length}
      style={style}
    >
      {selectionTip}
      {children}
    </div>
  );
}

interface TextHighlightProps {
  highlight: Highlight;
  isScrolledTo?: boolean;
  style?: CSSProperties;
}

export function TextHighlight({ highlight }: TextHighlightProps) {
  return <div data-testid="text-highlight" data-highlight-id={highlight.id} />;
}

interface AreaHighlightProps {
  highlight: Highlight;
  isScrolledTo?: boolean;
  style?: CSSProperties;
}

export function AreaHighlight({ highlight }: AreaHighlightProps) {
  return <div data-testid="area-highlight" data-highlight-id={highlight.id} />;
}

interface MonitoredHighlightContainerProps {
  highlightTip?: {
    position: unknown;
    content: ReactNode;
  };
  children?: ReactNode;
}

export function MonitoredHighlightContainer({
  highlightTip,
  children,
}: MonitoredHighlightContainerProps) {
  return (
    <div data-testid="monitored-highlight-container">
      {highlightTip?.content}
      {children}
    </div>
  );
}

// =============================================================================
// MOCK CONTEXT HOOKS
// =============================================================================

// Default mock highlight for useHighlightContainerContext
const defaultMockHighlight = {
  id: 'test-highlight-1',
  reviewUri: 'at://test/review/1',
  type: 'text' as const,
  authorName: 'Dr. Test',
  excerpt: 'Test excerpt',
  replyCount: 2,
  position: {
    boundingRect: { x1: 0.1, y1: 0.2, x2: 0.5, y2: 0.3, width: 1, height: 1, pageNumber: 1 },
    rects: [{ x1: 0.1, y1: 0.2, x2: 0.5, y2: 0.3, width: 1, height: 1, pageNumber: 1 }],
  },
};

let mockHighlightContext: { highlight: unknown; isScrolledTo: boolean } = {
  highlight: defaultMockHighlight,
  isScrolledTo: false,
};

export function setMockHighlightContext<T>(context: { highlight: T; isScrolledTo: boolean }) {
  mockHighlightContext = context;
}

export function useHighlightContainerContext<T extends Highlight>(): {
  highlight: ViewportHighlight<T>;
  isScrolledTo: boolean;
} {
  // Use unknown casting to allow arbitrary mock data structures
  return mockHighlightContext as unknown as {
    highlight: ViewportHighlight<T>;
    isScrolledTo: boolean;
  };
}

export function usePdfHighlighterContext() {
  return {};
}
