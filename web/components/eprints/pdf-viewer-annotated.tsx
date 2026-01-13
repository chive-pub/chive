'use client';

/**
 * PDF viewer with integrated annotation support using react-pdf-highlighter-extended.
 *
 * @remarks
 * Provides a full-featured PDF annotation experience with:
 * - Text selection and highlighting
 * - Area/rectangular highlights
 * - Annotation comments and entity linking
 * - Scrolling to annotations
 * - Viewport-independent coordinate storage (W3C compatible)
 *
 * @see https://github.com/DanielArnould/react-pdf-highlighter-extended
 *
 * @example
 * ```tsx
 * <AnnotatedPDFViewer
 *   blobRef={eprint.document}
 *   pdsEndpoint={eprint.source.pdsEndpoint}
 *   did={eprint.author.did}
 *   eprintUri={eprint.uri}
 *   onAnnotationCreate={handleAnnotationCreate}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  PdfLoader,
  PdfHighlighter,
  TextHighlight,
  AreaHighlight,
  MonitoredHighlightContainer,
  useHighlightContainerContext,
  type Highlight,
  type PdfSelection,
  type ScaledPosition,
  type PdfHighlighterUtils,
  type ViewportHighlight,
} from 'react-pdf-highlighter-extended';
import 'react-pdf-highlighter-extended/dist/esm/style/PdfHighlighter.css';
import 'react-pdf-highlighter-extended/dist/esm/style/AreaHighlight.css';
import 'react-pdf-highlighter-extended/dist/esm/style/TextHighlight.css';
import 'react-pdf-highlighter-extended/dist/esm/style/MouseSelection.css';
import {
  MessageSquare,
  Link2,
  X,
  ZoomIn,
  ZoomOut,
  Download,
  Maximize,
  Minimize,
  Eye,
  EyeOff,
  AlertCircle,
  RotateCcw,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import { useInlineReviews } from '@/lib/hooks/use-review';
import { useIsAuthenticated } from '@/lib/auth';
import type { BlobRef, TextSpanTarget, Review } from '@/lib/api/schema';

// Configure PDF.js worker to match the pdfjs-dist version used by react-pdf-highlighter-extended
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Extended highlight with Chive-specific metadata.
 */
export interface ChiveHighlight extends Highlight {
  /** Review URI in AT Protocol format */
  reviewUri: string;
  /** Author display name */
  authorName: string;
  /** Comment excerpt */
  excerpt: string;
  /** Number of replies */
  replyCount: number;
  /** Highlight color class */
  colorClass: string;
  /** Original review target for W3C format */
  w3cTarget?: TextSpanTarget;
}

/**
 * Props for the AnnotatedPDFViewer component.
 */
export interface AnnotatedPDFViewerProps {
  /** Blob reference from ATProto */
  blobRef: BlobRef;
  /** PDS endpoint URL for blob retrieval */
  pdsEndpoint: string;
  /** DID of the blob owner */
  did: string;
  /** AT-URI of the eprint (for annotations) */
  eprintUri: string;
  /** Callback when annotation is clicked */
  onAnnotationSelect?: (uri: string) => void;
  /** Callback to add a new review */
  onAddReview?: (target: TextSpanTarget, selectedText: string) => void;
  /** Callback to link entity */
  onLinkEntity?: (target: TextSpanTarget, selectedText: string) => void;
  /** Callback for scroll-to-annotation requests from external components */
  scrollToAnnotationUri?: string;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COORDINATE CONVERSION UTILITIES
// =============================================================================

/**
 * Context characters to capture before/after selection for W3C TextQuoteSelector.
 */
const CONTEXT_CHARS = 32;

/**
 * Extract text selection context (prefix and suffix) from the DOM.
 *
 * This captures surrounding text for W3C TextQuoteSelector anchoring,
 * which makes annotations resilient to minor text changes.
 */
function extractSelectionContext(): { prefix: string; suffix: string } {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { prefix: '', suffix: '' };
  }

  try {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    // Get the text layer element (parent with class "textLayer")
    let textLayer: Element | null = null;
    let node: Node | null = container;
    while (node && !textLayer) {
      if (node instanceof Element && node.classList?.contains('textLayer')) {
        textLayer = node;
      }
      node = node.parentNode;
    }

    if (!textLayer) {
      // Fallback: use container's text content
      const text = container.textContent || '';
      const startOffset = range.startOffset;
      const endOffset = range.endOffset;

      return {
        prefix: text.slice(Math.max(0, startOffset - CONTEXT_CHARS), startOffset),
        suffix: text.slice(endOffset, endOffset + CONTEXT_CHARS),
      };
    }

    // Get full text layer content and find selection position
    const fullText = textLayer.textContent || '';
    const selectedText = selection.toString();

    // Find the selection in the full text
    // Use range's text position within the text layer
    const preRange = document.createRange();
    preRange.setStart(textLayer, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const preText = preRange.toString();

    const startIndex = preText.length;
    const endIndex = startIndex + selectedText.length;

    return {
      prefix: fullText.slice(Math.max(0, startIndex - CONTEXT_CHARS), startIndex).trim(),
      suffix: fullText.slice(endIndex, endIndex + CONTEXT_CHARS).trim(),
    };
  } catch {
    // Selection context extraction failed, return empty
    return { prefix: '', suffix: '' };
  }
}

/**
 * Convert react-pdf-highlighter ScaledPosition to W3C TextSpanTarget.
 *
 * Implements W3C Web Annotation Data Model with:
 * - TextQuoteSelector (exact + prefix + suffix) for robust text anchoring
 * - TextPositionSelector (in refinedBy) for position hints and visual rendering
 */
function scaledPositionToW3CTarget(
  position: ScaledPosition,
  selectedText: string,
  eprintUri: string,
  context?: { prefix: string; suffix: string }
): TextSpanTarget {
  // Estimate character offset based on vertical position on page.
  // This is approximate but useful for sorting annotations by position.
  const estimatedCharsPerPage = 5000;
  const approximateStart = Math.round(position.boundingRect.y1 * estimatedCharsPerPage);
  const approximateEnd = approximateStart + selectedText.length;

  return {
    source: eprintUri,
    selector: {
      type: 'TextQuoteSelector',
      exact: selectedText,
      // Include prefix/suffix if available for robust anchoring
      ...(context?.prefix && { prefix: context.prefix }),
      ...(context?.suffix && { suffix: context.suffix }),
    },
    refinedBy: {
      type: 'TextPositionSelector',
      start: approximateStart,
      end: approximateEnd,
      pageNumber: position.boundingRect.pageNumber,
      // Store scaled coordinates for precise visual positioning
      boundingRect: {
        x1: position.boundingRect.x1,
        y1: position.boundingRect.y1,
        x2: position.boundingRect.x2,
        y2: position.boundingRect.y2,
        width: position.boundingRect.width,
        height: position.boundingRect.height,
      },
    },
  };
}

/**
 * Convert W3C TextSpanTarget to react-pdf-highlighter ScaledPosition.
 *
 * The W3C Web Annotation model uses TextQuoteSelector for robust anchoring:
 * - selector.exact: the selected text
 * - selector.prefix/suffix: surrounding context for disambiguation
 *
 * The refinedBy TextPositionSelector provides:
 * - boundingRect: precise visual coordinates (preferred)
 * - start/end: approximate character offsets (fallback)
 *
 * For optimal accuracy, stored annotations include boundingRect.
 * External annotations without boundingRect fall back to position estimation.
 */
function w3cTargetToScaledPosition(target: TextSpanTarget): ScaledPosition | null {
  const refinedBy = target.refinedBy;
  if (!refinedBy?.pageNumber) return null;

  // Priority 1: Use stored bounding rect coordinates (most accurate)
  const boundingRect = (refinedBy as { boundingRect?: ScaledPosition['boundingRect'] })
    .boundingRect;

  if (boundingRect) {
    return {
      boundingRect: {
        ...boundingRect,
        pageNumber: refinedBy.pageNumber,
      },
      rects: [
        {
          ...boundingRect,
          pageNumber: refinedBy.pageNumber,
        },
      ],
    };
  }

  // Priority 2: Estimate position from TextPositionSelector start/end.
  // The start value is an approximate character offset on the page.
  // Convert back to normalized Y position using the same estimation factor.
  const estimatedCharsPerPage = 5000;
  const approximateY = refinedBy.start
    ? Math.min(refinedBy.start / estimatedCharsPerPage, 0.95)
    : 0.1;

  // Estimate width based on text length (approximate)
  const textLength = target.selector?.exact?.length ?? 50;
  const estimatedWidth = Math.min(0.9, textLength * 0.01);
  const lineHeight = 0.025;

  return {
    boundingRect: {
      x1: 0.05,
      y1: approximateY,
      x2: 0.05 + estimatedWidth,
      y2: approximateY + lineHeight,
      width: 1,
      height: 1,
      pageNumber: refinedBy.pageNumber,
    },
    rects: [
      {
        x1: 0.05,
        y1: approximateY,
        x2: 0.05 + estimatedWidth,
        y2: approximateY + lineHeight,
        width: 1,
        height: 1,
        pageNumber: refinedBy.pageNumber,
      },
    ],
  };
}

/**
 * Convert reviews to ChiveHighlight format.
 */
function reviewsToHighlights(reviews: Review[]): ChiveHighlight[] {
  const highlights: ChiveHighlight[] = [];

  for (const review of reviews) {
    if (!review.target) continue;

    const position = w3cTargetToScaledPosition(review.target);
    if (!position) continue;

    highlights.push({
      id: review.uri,
      reviewUri: review.uri,
      type: 'text',
      position,
      authorName: review.author.displayName || review.author.handle || 'Anonymous',
      excerpt: review.content.slice(0, 150),
      replyCount: 0,
      colorClass:
        'bg-yellow-200/60 hover:bg-yellow-300/70 dark:bg-yellow-500/40 dark:hover:bg-yellow-500/60',
      w3cTarget: review.target,
    });
  }

  return highlights;
}

// =============================================================================
// HIGHLIGHT CONTAINER COMPONENT
// =============================================================================

/**
 * Props for HighlightContainer.
 */
interface HighlightContainerProps {
  onHighlightClick?: (highlight: ViewportHighlight<ChiveHighlight>) => void;
}

/**
 * Renders individual highlights with tooltips.
 */
function HighlightContainer({ onHighlightClick }: HighlightContainerProps) {
  const { highlight, isScrolledTo } = useHighlightContainerContext<ChiveHighlight>();

  const isTextHighlight = highlight.type === 'text' || !highlight.type;

  const highlightElement = isTextHighlight ? (
    <TextHighlight
      isScrolledTo={isScrolledTo}
      highlight={highlight}
      style={{
        background: isScrolledTo ? 'rgba(59, 130, 246, 0.5)' : 'rgba(250, 204, 21, 0.4)',
      }}
    />
  ) : (
    <AreaHighlight
      isScrolledTo={isScrolledTo}
      highlight={highlight}
      style={{
        background: isScrolledTo ? 'rgba(59, 130, 246, 0.3)' : 'rgba(250, 204, 21, 0.3)',
        border: isScrolledTo ? '2px solid rgb(59, 130, 246)' : '2px solid rgb(250, 204, 21)',
      }}
    />
  );

  return (
    <MonitoredHighlightContainer
      highlightTip={{
        position: highlight.position,
        content: (
          <div className="rounded-lg border bg-popover p-3 shadow-lg max-w-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{highlight.authorName}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-3">{highlight.excerpt}</p>
            {highlight.replyCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {highlight.replyCount} {highlight.replyCount === 1 ? 'reply' : 'replies'}
              </p>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 h-7 text-xs w-full"
              onClick={() => onHighlightClick?.(highlight)}
            >
              View annotation
            </Button>
          </div>
        ),
      }}
    >
      {highlightElement}
    </MonitoredHighlightContainer>
  );
}

// =============================================================================
// SELECTION TIP COMPONENT
// =============================================================================

/**
 * Props for SelectionTip.
 */
interface SelectionTipProps {
  selection: PdfSelection;
  onAddComment: () => void;
  onLinkEntity: () => void;
  onCancel: () => void;
}

/**
 * Tip shown when text is selected.
 */
function SelectionTip({ selection, onAddComment, onLinkEntity, onCancel }: SelectionTipProps) {
  const selectedText = selection.content.text || '';
  const displayText = selectedText.length > 60 ? selectedText.slice(0, 60) + '...' : selectedText;

  return (
    <div className="rounded-lg border bg-popover p-3 shadow-lg min-w-[200px]">
      <div className="flex items-start gap-2 mb-3">
        <p className="text-xs text-muted-foreground line-clamp-2 flex-1 italic">
          &ldquo;{displayText}&rdquo;
        </p>
        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onCancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs flex-1"
          onClick={onAddComment}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Comment
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs flex-1"
          onClick={onLinkEntity}
        >
          <Link2 className="h-3.5 w-3.5" />
          Link
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * PDF viewer with integrated annotation support.
 */
export function AnnotatedPDFViewer({
  blobRef,
  pdsEndpoint,
  did,
  eprintUri,
  onAnnotationSelect,
  onAddReview,
  onLinkEntity,
  scrollToAnnotationUri,
  className,
}: AnnotatedPDFViewerProps) {
  const isAuthenticated = useIsAuthenticated();

  // State
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<PdfSelection | null>(null);
  const [scale, setScale] = useState<number>(1.0);

  // Refs
  const highlighterUtilsRef = useRef<PdfHighlighterUtils | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch inline reviews
  const { data: inlineReviewsData } = useInlineReviews(eprintUri, {
    enabled: showAnnotations,
  });

  // Convert reviews to highlights
  const highlights = useMemo<ChiveHighlight[]>(() => {
    if (!showAnnotations || !inlineReviewsData?.reviews) return [];
    return reviewsToHighlights(inlineReviewsData.reviews);
  }, [showAnnotations, inlineReviewsData?.reviews]);

  // Construct PDF URL
  const pdfUrl = `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(blobRef.ref)}`;

  // Handle scroll to annotation
  useEffect(() => {
    if (scrollToAnnotationUri && highlighterUtilsRef.current) {
      const highlight = highlights.find((h) => h.reviewUri === scrollToAnnotationUri);
      if (highlight) {
        highlighterUtilsRef.current.scrollToHighlight(highlight);
      }
    }
  }, [scrollToAnnotationUri, highlights]);

  // Handle highlight click
  const handleHighlightClick = useCallback(
    (highlight: ViewportHighlight<ChiveHighlight>) => {
      onAnnotationSelect?.(highlight.reviewUri);
    },
    [onAnnotationSelect]
  );

  // Handle adding comment from selection
  const handleAddComment = useCallback(() => {
    if (!currentSelection || !onAddReview) return;

    // Extract context BEFORE clearing selection for W3C TextQuoteSelector anchoring
    const context = extractSelectionContext();

    const selectedText = currentSelection.content.text || '';
    const ghostHighlight = currentSelection.makeGhostHighlight();
    const w3cTarget = scaledPositionToW3CTarget(
      ghostHighlight.position,
      selectedText,
      eprintUri,
      context
    );

    onAddReview(w3cTarget, selectedText);
    setCurrentSelection(null);
    highlighterUtilsRef.current?.setTip(null);
  }, [currentSelection, onAddReview, eprintUri]);

  // Handle linking entity from selection
  const handleLinkEntity = useCallback(() => {
    if (!currentSelection || !onLinkEntity) return;

    // Extract context BEFORE clearing selection for W3C TextQuoteSelector anchoring
    const context = extractSelectionContext();

    const selectedText = currentSelection.content.text || '';
    const ghostHighlight = currentSelection.makeGhostHighlight();
    const w3cTarget = scaledPositionToW3CTarget(
      ghostHighlight.position,
      selectedText,
      eprintUri,
      context
    );

    onLinkEntity(w3cTarget, selectedText);
    setCurrentSelection(null);
    highlighterUtilsRef.current?.setTip(null);
  }, [currentSelection, onLinkEntity, eprintUri]);

  // Handle cancel selection
  const handleCancelSelection = useCallback(() => {
    setCurrentSelection(null);
    highlighterUtilsRef.current?.setTip(null);
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  // Download
  const handleDownload = useCallback(() => {
    window.open(pdfUrl, '_blank');
  }, [pdfUrl]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Selection tip render (library handles positioning internally).
  const selectionTipContent = useMemo(() => {
    if (!currentSelection || !isAuthenticated) return null;

    return (
      <SelectionTip
        selection={currentSelection}
        onAddComment={handleAddComment}
        onLinkEntity={handleLinkEntity}
        onCancel={handleCancelSelection}
      />
    );
  }, [
    currentSelection,
    isAuthenticated,
    handleAddComment,
    handleLinkEntity,
    handleCancelSelection,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border bg-muted/50',
        isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-background px-3 py-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[60px] text-center text-sm">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={scale >= 3.0}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {/* Annotation controls */}
        <div className="flex items-center gap-2">
          <Toggle
            size="sm"
            pressed={showAnnotations}
            onPressedChange={setShowAnnotations}
            aria-label="Toggle annotations"
          >
            {showAnnotations ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Toggle>
          {highlights.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              {highlights.length}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div
        className="flex-1 overflow-hidden"
        style={{ height: isFullscreen ? 'calc(100vh - 56px)' : '600px' }}
      >
        <PdfLoader
          document={pdfUrl}
          workerSrc={`https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`}
          beforeLoad={() => <AnnotatedPDFViewerSkeleton />}
          errorMessage={(error) => (
            <AnnotatedPDFViewerError
              error={error instanceof Error ? error.message : String(error)}
            />
          )}
        >
          {(pdfDocument) => (
            <PdfHighlighter
              pdfDocument={pdfDocument}
              highlights={highlights}
              pdfScaleValue={scale}
              enableAreaSelection={(event) => event.altKey}
              onSelection={(selection) => {
                if (isAuthenticated) {
                  setCurrentSelection(selection);
                }
              }}
              selectionTip={selectionTipContent}
              utilsRef={(utils) => {
                highlighterUtilsRef.current = utils;
              }}
              style={{
                height: '100%',
              }}
            >
              <HighlightContainer onHighlightClick={handleHighlightClick} />
            </PdfHighlighter>
          )}
        </PdfLoader>
      </div>

      {/* Auth hint */}
      {!isAuthenticated && (
        <div className="border-t bg-muted/50 px-4 py-2 text-center text-xs text-muted-foreground">
          Sign in to highlight text and add inline annotations
        </div>
      )}
    </div>
  );
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

/**
 * Loading skeleton for AnnotatedPDFViewer.
 */
export function AnnotatedPDFViewerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center h-full p-8', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
      <p className="text-sm text-muted-foreground">Loading PDF...</p>
    </div>
  );
}

// =============================================================================
// ERROR STATE
// =============================================================================

/**
 * Error state for AnnotatedPDFViewer.
 */
function AnnotatedPDFViewerError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="font-semibold mb-2">Failed to load PDF</h3>
      <p className="text-sm text-muted-foreground mb-4">{error}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}
