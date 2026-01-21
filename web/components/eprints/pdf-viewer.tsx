'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize,
  Minimize,
  RotateCw,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BlobRef } from '@/lib/api/schema';

/**
 * Props for the PDFViewer component.
 */
export interface PDFViewerProps {
  /** Blob reference from ATProto */
  blobRef: BlobRef;
  /** PDS endpoint URL for blob retrieval */
  pdsEndpoint: string;
  /** DID of the blob owner */
  did: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Interactive PDF viewer for eprint documents.
 *
 * @remarks
 * Client component using PDF.js for rendering PDFs from ATProto blobs.
 * Loads PDF.js dynamically to avoid SSR issues. Supports zoom, navigation,
 * and fullscreen viewing.
 *
 * @example
 * ```tsx
 * <PDFViewer
 *   blobRef={eprint.document}
 *   pdsEndpoint={eprint.source.pdsEndpoint}
 *   did={eprint.author.did}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the PDF viewer
 */
export function PDFViewer({ blobRef, pdsEndpoint, did, className }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfModule, setPdfModule] = useState<typeof import('react-pdf') | null>(null);

  // Construct blob URL from PDS endpoint
  // blobRef.ref can be a string, { $link: string }, or a CID object with toString()
  const getCidString = (): string => {
    if (typeof blobRef.ref === 'string') {
      return blobRef.ref;
    }
    if (typeof blobRef.ref === 'object' && blobRef.ref !== null) {
      if ('$link' in blobRef.ref) {
        return (blobRef.ref as { $link: string }).$link;
      }
      // CID object from multiformats
      return blobRef.ref.toString();
    }
    return String(blobRef.ref);
  };
  const cid = getCidString();
  const pdfUrl = `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;

  // Dynamically import react-pdf to avoid SSR issues
  useEffect(() => {
    import('react-pdf').then((module) => {
      // Set up PDF.js worker
      module.pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${module.pdfjs.version}/build/pdf.worker.min.mjs`;
      setPdfModule(module);
    });
  }, []);

  const handleDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
  }, []);

  const handleDocumentLoadError = useCallback((err: Error) => {
    setError(err.message || 'Failed to load PDF');
    setIsLoading(false);
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= numPages) {
        setCurrentPage(page);
      }
    },
    [numPages]
  );

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1.0);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleDownload = useCallback(() => {
    window.open(pdfUrl, '_blank');
  }, [pdfUrl]);

  if (!pdfModule) {
    return <PDFViewerSkeleton className={className} />;
  }

  const { Document, Page } = pdfModule;

  if (error) {
    return <PDFViewerError error={error} onRetry={() => setError(null)} className={className} />;
  }

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border bg-muted/50',
        isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
    >
      {/* Toolbar */}
      <PDFToolbar
        currentPage={currentPage}
        numPages={numPages}
        scale={scale}
        isFullscreen={isFullscreen}
        onPageChange={goToPage}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        onToggleFullscreen={toggleFullscreen}
        onDownload={handleDownload}
      />

      {/* Document viewer */}
      <div className="relative flex-1 overflow-auto">
        {isLoading && <PDFViewerSkeleton />}

        <div className="flex min-h-full items-start justify-center p-4">
          <Document
            file={pdfUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading=""
            className="shadow-lg"
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="bg-white"
            />
          </Document>
        </div>
      </div>

      {/* Page indicator for mobile */}
      <div className="flex items-center justify-center gap-2 border-t bg-background py-2 text-sm md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>
          {currentPage} / {numPages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= numPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Props for the PDFToolbar component.
 */
interface PDFToolbarProps {
  currentPage: number;
  numPages: number;
  scale: number;
  isFullscreen: boolean;
  onPageChange: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleFullscreen: () => void;
  onDownload: () => void;
}

/**
 * Toolbar for PDF viewer controls.
 */
function PDFToolbar({
  currentPage,
  numPages,
  scale,
  isFullscreen,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleFullscreen,
  onDownload,
}: PDFToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b bg-background px-2 py-1">
      {/* Page navigation */}
      <div className="hidden items-center gap-1 md:flex">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[80px] text-center text-sm">
          {currentPage} / {numPages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= numPages}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomOut}
          disabled={scale <= 0.5}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onResetZoom} className="min-w-[60px] text-xs">
          {Math.round(scale * 100)}%
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomIn}
          disabled={scale >= 3.0}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onDownload} title="Download PDF">
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleFullscreen} title="Toggle fullscreen">
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

/**
 * Props for the PDFViewerSkeleton component.
 */
export interface PDFViewerSkeletonProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for the PDFViewer component.
 *
 * @example
 * ```tsx
 * {isLoading && <PDFViewerSkeleton />}
 * ```
 */
export function PDFViewerSkeleton({ className }: PDFViewerSkeletonProps) {
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-lg border bg-muted/50', className)}>
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between border-b bg-background px-2 py-1">
        <div className="flex items-center gap-1">
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex items-center gap-1">
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          <div className="h-4 w-12 animate-pulse rounded bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex items-center gap-1">
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Document skeleton */}
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="aspect-[8.5/11] w-full max-w-lg animate-pulse rounded bg-muted shadow-lg" />
      </div>
    </div>
  );
}

/**
 * Props for the PDFViewerError component.
 */
interface PDFViewerErrorProps {
  error: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Error state for the PDFViewer component.
 */
function PDFViewerError({ error, onRetry, className }: PDFViewerErrorProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border bg-muted/50 p-8 text-center',
        className
      )}
    >
      <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
      <h3 className="mb-2 font-semibold">Failed to load PDF</h3>
      <p className="mb-4 text-sm text-muted-foreground">{error}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RotateCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Props for the PDFDownloadButton component.
 */
export interface PDFDownloadButtonProps {
  /** Blob reference from ATProto */
  blobRef: BlobRef;
  /** PDS endpoint URL */
  pdsEndpoint: string;
  /** DID of the blob owner */
  did: string;
  /** Optional filename for download */
  filename?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Download button for PDFs stored in ATProto.
 *
 * @example
 * ```tsx
 * <PDFDownloadButton
 *   blobRef={eprint.document}
 *   pdsEndpoint={eprint.source.pdsEndpoint}
 *   did={eprint.author.did}
 *   filename={`${eprint.title}.pdf`}
 * />
 * ```
 */
export function PDFDownloadButton({
  blobRef,
  pdsEndpoint,
  did,
  filename,
  className,
}: PDFDownloadButtonProps) {
  // blobRef.ref can be a string, { $link: string }, or a CID object with toString()
  const getCidString = (): string => {
    if (typeof blobRef.ref === 'string') {
      return blobRef.ref;
    }
    if (typeof blobRef.ref === 'object' && blobRef.ref !== null) {
      if ('$link' in blobRef.ref) {
        return (blobRef.ref as { $link: string }).$link;
      }
      // CID object from multiformats
      return blobRef.ref.toString();
    }
    return String(blobRef.ref);
  };
  const cid = getCidString();
  const pdfUrl = `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename ?? 'document.pdf';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [pdfUrl, filename]);

  return (
    <Button variant="outline" onClick={handleDownload} className={className}>
      <Download className="mr-2 h-4 w-4" />
      Download PDF
    </Button>
  );
}
