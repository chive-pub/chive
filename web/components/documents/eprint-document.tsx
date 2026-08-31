'use client';

/**
 * Renders an eprint's manuscript in whatever format it was submitted in.
 *
 * @remarks
 * The eprint page mounted `AnnotatedPDFViewer` unconditionally, so every
 * document went to pdf.js regardless of what it was. The submission wizard
 * accepts ten formats, and pdf.js rejects nine of them — a Markdown or LaTeX
 * manuscript rendered as a broken-document error. `DocumentViewer` already knew
 * how to render five of those formats and was mounted nowhere.
 *
 * This dispatches on the blob's MIME type:
 *
 * - **PDF** keeps the annotated viewer, with highlighting and inline review.
 * - **HTML, Markdown, LaTeX, Jupyter and plain text** are fetched from the PDS
 *   as text and rendered by `DocumentViewer`. Text selection is forwarded, so
 *   selecting a passage still offers the review action.
 * - **DOCX, ODT, RTF and EPUB** are binary formats with no renderer here. They
 *   get an honest message naming the format and a download, rather than a
 *   viewer that fails.
 *
 * Blobs are fetched from the author's PDS, which is where they live; Chive
 * stores only the reference.
 *
 * @packageDocumentation
 */

import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';

import { DocumentViewer } from '@/components/documents/document-viewer';
import { AnnotatedPDFViewerSkeleton } from '@/components/eprints/pdf-viewer-skeleton';
import { Button } from '@/components/ui/button';
import {
  detectDocumentFormat,
  formatDisplayName,
  isPdfFormat,
  isTextFormat,
} from '@/lib/documents/document-format';
import { cn } from '@/lib/utils';
import type { BlobRef } from '@/lib/api/schema';

/**
 * Props for {@link EprintDocument}.
 *
 * @public
 */
export interface EprintDocumentProps {
  /** The manuscript blob reference */
  blobRef: BlobRef;
  /** PDS endpoint the blob is fetched from */
  pdsEndpoint: string;
  /** DID of the repository holding the blob */
  did: string;
  /** Callback when text is selected, for inline review */
  onTextSelect?: (selection: { text: string; context?: string }) => void;
  /** Additional class names */
  className?: string;
  /** Rendered for PDFs; the caller owns the annotation wiring */
  renderPdf: () => React.ReactNode;
}

/**
 * Extracts the CID string from a blob reference.
 *
 * @remarks
 * A `BlobRef` may carry its CID as `ref.$link`, as a bare `ref`, or as `cid`,
 * depending on whether it came through the XRPC client or straight from a
 * record. All three shapes appear in practice.
 */
function cidOf(blobRef: BlobRef): string {
  const ref = (blobRef as { ref?: unknown }).ref;
  if (ref && typeof ref === 'object' && '$link' in ref) {
    return String((ref as { $link: unknown }).$link);
  }
  if (typeof ref === 'string') {
    return ref;
  }
  return String((blobRef as { cid?: unknown }).cid ?? '');
}

/**
 * Renders an eprint's document according to its format.
 *
 * @param props - Component props
 * @returns The appropriate viewer for the document's format
 *
 * @public
 */
export function EprintDocument({
  blobRef,
  pdsEndpoint,
  did,
  onTextSelect,
  className,
  renderPdf,
}: EprintDocumentProps) {
  const mimeType = (blobRef as { mimeType?: string }).mimeType;
  const format = detectDocumentFormat(mimeType);
  const blobUrl = `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cidOf(blobRef))}`;

  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsText = isTextFormat(format);

  useEffect(() => {
    if (!needsText) {
      return;
    }

    // A slow or unreachable PDS must not leave the viewer spinning forever, and
    // an unmounted component must not set state.
    const controller = new AbortController();
    setContent(null);
    setError(null);

    fetch(blobUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not fetch the document (${String(response.status)})`);
        }
        return response.text();
      })
      .then(setContent)
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not fetch the document');
      });

    return () => {
      controller.abort();
    };
  }, [blobUrl, needsText]);

  if (isPdfFormat(format)) {
    return <>{renderPdf()}</>;
  }

  if (!needsText) {
    return (
      <div
        className={cn(
          'flex min-h-[400px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center',
          className
        )}
      >
        <FileText className="h-12 w-12 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">
          This manuscript is {aOrAn(formatDisplayName(format))}, which cannot be displayed in the
          browser.
        </p>
        <Button asChild variant="outline">
          <a href={blobUrl} download>
            <Download className="mr-2 h-4 w-4" />
            Download to read
          </a>
        </Button>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div
        className={cn(
          'flex min-h-[400px] flex-col items-center justify-center gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center',
          className
        )}
      >
        <p className="text-destructive">{error}</p>
        <p className="text-sm text-muted-foreground">
          The document is stored on the author&apos;s PDS, which may be temporarily unreachable.
        </p>
        <Button asChild variant="outline">
          <a href={blobUrl} download>
            <Download className="mr-2 h-4 w-4" />
            Download instead
          </a>
        </Button>
      </div>
    );
  }

  if (content === null) {
    return <AnnotatedPDFViewerSkeleton className={className} />;
  }

  return (
    <DocumentViewer
      source={{ format, content, url: blobUrl }}
      onTextSelect={onTextSelect ? (selection) => onTextSelect(selection) : undefined}
      className={className}
    />
  );
}

/**
 * Prefixes a format name with the right indefinite article.
 */
function aOrAn(name: string): string {
  return /^[AEIOU]/i.test(name) ? `an ${name}` : `a ${name}`;
}
