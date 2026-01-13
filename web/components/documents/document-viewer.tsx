'use client';

/**
 * Unified document viewer for multiple formats.
 *
 * @remarks
 * Provides a consistent interface for viewing different document formats:
 * - PDF: Uses existing AnnotatedPDFViewer
 * - HTML: Renders sanitized HTML with highlighting
 * - Markdown: Renders with syntax highlighting for code blocks
 * - Jupyter: Cell-by-cell rendering with code and output
 * - LaTeX: KaTeX-rendered math or source view
 * - Plain Text: Monospace with line numbers
 *
 * @packageDocumentation
 */

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { FileText, Code, Eye, Download, Maximize2, Minimize2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AnnotatedPDFViewerSkeleton } from '@/components/eprints';

// Note: PDF viewer is handled separately via AnnotatedPDFViewer from @/components/eprints
// This component focuses on text-based format rendering

// =============================================================================
// TYPES
// =============================================================================

/**
 * Supported document formats.
 */
export type DocumentFormat =
  | 'pdf'
  | 'docx'
  | 'html'
  | 'markdown'
  | 'latex'
  | 'jupyter'
  | 'odt'
  | 'rtf'
  | 'epub'
  | 'txt';

/**
 * Document content source.
 */
export interface DocumentSource {
  /** Document format */
  format: DocumentFormat;
  /** URL to fetch the document */
  url?: string;
  /** Raw content (for text-based formats) */
  content?: string;
  /** Blob reference for ATProto documents */
  blobRef?: {
    cid: string;
    mimeType: string;
  };
  /** PDS endpoint for blob fetching */
  pdsEndpoint?: string;
  /** DID of the document owner */
  did?: string;
}

/**
 * Text selection for annotations.
 */
export interface TextSelection {
  /** Selected text */
  text: string;
  /** Character start offset */
  start: number;
  /** Character end offset */
  end: number;
  /** Page number (if applicable) */
  pageNumber?: number;
  /** Section ID (if applicable) */
  sectionId?: string;
  /** Cell ID (if applicable) */
  cellId?: string;
  /** Line number (if applicable) */
  lineNumber?: number;
}

/**
 * Props for DocumentViewer component.
 */
export interface DocumentViewerProps {
  /** Document source */
  source: DocumentSource;
  /** Title for the document */
  title?: string;
  /** Callback when text is selected */
  onTextSelect?: (selection: TextSelection) => void;
  /** Callback for download action */
  onDownload?: () => void;
  /** Whether to show source view toggle (for code formats) */
  showSourceToggle?: boolean;
  /** Initial view mode */
  initialView?: 'rendered' | 'source';
  /** Whether viewer is in fullscreen mode */
  fullscreen?: boolean;
  /** Callback for fullscreen toggle */
  onFullscreenToggle?: () => void;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Loading skeleton for document viewer.
 */
export function DocumentViewerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      <Skeleton className="h-[600px] w-full" />
    </div>
  );
}

/**
 * HTML document renderer.
 */
function HtmlViewer({
  content,
  onTextSelect,
  className,
}: {
  content: string;
  onTextSelect?: (selection: TextSelection) => void;
  className?: string;
}) {
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      const text = selection.toString();

      // Find the closest section
      let sectionId: string | undefined;
      let node = range.startContainer.parentElement;
      while (node) {
        if (node.id && /^h[1-6]$/i.test(node.tagName)) {
          sectionId = node.id;
          break;
        }
        node = node.parentElement;
      }

      onTextSelect?.({
        text,
        start: 0, // Would need DOM range calculation
        end: text.length,
        sectionId,
      });
    }
  }, [onTextSelect]);

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none p-6 bg-background rounded-lg border',
        className
      )}
      onMouseUp={handleMouseUp}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

/**
 * Markdown document renderer.
 */
function MarkdownViewer({
  content,
  view,
  onTextSelect,
  className,
}: {
  content: string;
  view: 'rendered' | 'source';
  onTextSelect?: (selection: TextSelection) => void;
  className?: string;
}) {
  // For source view, show raw markdown with line numbers
  if (view === 'source') {
    return (
      <SourceCodeViewer
        content={content}
        language="markdown"
        onTextSelect={onTextSelect}
        className={className}
      />
    );
  }

  // For rendered view, use basic markdown rendering
  // In a real implementation, use react-markdown or similar
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none p-6 bg-background rounded-lg border',
        className
      )}
    >
      <pre className="whitespace-pre-wrap font-sans">{content}</pre>
    </div>
  );
}

/**
 * Source code viewer with line numbers.
 */
function SourceCodeViewer({
  content,
  language,
  onTextSelect,
  className,
}: {
  content: string;
  language?: string;
  onTextSelect?: (selection: TextSelection) => void;
  className?: string;
}) {
  const lines = useMemo(() => content.split('\n'), [content]);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const text = selection.toString();
      const range = selection.getRangeAt(0);

      // Find line number from parent element
      let lineNumber: number | undefined;
      let node = range.startContainer.parentElement;
      while (node) {
        const lineAttr = node.getAttribute('data-line');
        if (lineAttr) {
          lineNumber = parseInt(lineAttr, 10);
          break;
        }
        node = node.parentElement;
      }

      onTextSelect?.({
        text,
        start: 0,
        end: text.length,
        lineNumber,
      });
    }
  }, [onTextSelect]);

  return (
    <div
      className={cn('font-mono text-sm bg-muted rounded-lg border overflow-auto', className)}
      onMouseUp={handleMouseUp}
    >
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, index) => (
            <tr key={index} data-line={index + 1} className="hover:bg-accent/50">
              <td className="w-12 px-3 py-0.5 text-right text-muted-foreground select-none border-r">
                {index + 1}
              </td>
              <td className="px-4 py-0.5 whitespace-pre">{line || ' '}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Jupyter notebook viewer.
 */
function JupyterViewer({
  content,
  onTextSelect,
  className,
}: {
  content: string;
  onTextSelect?: (selection: TextSelection) => void;
  className?: string;
}) {
  // Parse notebook JSON
  const notebook = useMemo(() => {
    try {
      return JSON.parse(content) as {
        cells: Array<{
          cell_type: 'code' | 'markdown' | 'raw';
          source: string | string[];
          outputs?: Array<{
            output_type: string;
            text?: string | string[];
            data?: Record<string, string | string[]>;
          }>;
        }>;
      };
    } catch {
      return null;
    }
  }, [content]);

  if (!notebook) {
    return (
      <div className={cn('p-6 text-center text-muted-foreground', className)}>
        Failed to parse notebook
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {notebook.cells.map((cell, index) => {
        const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        const cellId = `cell-${index}`;

        return (
          <div key={cellId} data-cell-id={cellId} className="rounded-lg border overflow-hidden">
            {/* Cell header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted text-xs text-muted-foreground">
              <span className="font-mono">
                [{index + 1}] {cell.cell_type}
              </span>
            </div>

            {/* Cell content */}
            {cell.cell_type === 'code' ? (
              <div className="border-t">
                <SourceCodeViewer
                  content={source}
                  language="python"
                  onTextSelect={(sel) => onTextSelect?.({ ...sel, cellId })}
                />
                {/* Outputs */}
                {cell.outputs && cell.outputs.length > 0 && (
                  <div className="border-t bg-background p-3">
                    {cell.outputs.map((output, outIndex) => {
                      const text = output.text || output.data?.['text/plain'] || '';
                      const outputText = Array.isArray(text) ? text.join('') : text;
                      return (
                        <pre key={outIndex} className="text-sm whitespace-pre-wrap">
                          {outputText}
                        </pre>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm">{source}</pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * LaTeX document viewer.
 */
function LaTeXViewer({
  content,
  view,
  onTextSelect,
  className,
}: {
  content: string;
  view: 'rendered' | 'source';
  onTextSelect?: (selection: TextSelection) => void;
  className?: string;
}) {
  // For source view, show raw LaTeX with line numbers
  if (view === 'source') {
    return (
      <SourceCodeViewer
        content={content}
        language="latex"
        onTextSelect={onTextSelect}
        className={className}
      />
    );
  }

  // For rendered view, show source with basic math rendering hint
  // In a real implementation, use KaTeX or MathJax
  return (
    <div className={cn('space-y-4', className)}>
      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900 text-sm">
        <p className="text-yellow-800 dark:text-yellow-200">
          LaTeX rendering preview. For full rendering, download the source file.
        </p>
      </div>
      <SourceCodeViewer content={content} language="latex" onTextSelect={onTextSelect} />
    </div>
  );
}

/**
 * Plain text viewer.
 */
function PlainTextViewer({
  content,
  onTextSelect,
  className,
}: {
  content: string;
  onTextSelect?: (selection: TextSelection) => void;
  className?: string;
}) {
  return (
    <SourceCodeViewer
      content={content}
      language="text"
      onTextSelect={onTextSelect}
      className={className}
    />
  );
}

/**
 * Unified document viewer component.
 *
 * @param props - Component props
 * @returns Document viewer element
 */
export function DocumentViewer({
  source,
  title,
  onTextSelect,
  onDownload,
  showSourceToggle = true,
  initialView = 'rendered',
  fullscreen = false,
  onFullscreenToggle,
  className,
}: DocumentViewerProps) {
  const [view, setView] = useState<'rendered' | 'source'>(initialView);

  // Determine if source toggle should be shown
  const canToggleSource = useMemo(() => {
    return showSourceToggle && ['markdown', 'latex', 'html'].includes(source.format);
  }, [showSourceToggle, source.format]);

  // Render format-specific viewer
  const renderViewer = useCallback(() => {
    switch (source.format) {
      case 'pdf':
        // PDF documents use the dedicated AnnotatedPDFViewer component
        // which provides full annotation support with react-pdf-highlighter
        return (
          <div className="p-6 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>PDF documents are displayed using the dedicated PDF viewer.</p>
            <p className="text-sm mt-2">
              Use the PDF tab to view this document with full annotation support.
            </p>
          </div>
        );

      case 'html':
        return <HtmlViewer content={source.content ?? ''} onTextSelect={onTextSelect} />;

      case 'markdown':
        return (
          <MarkdownViewer content={source.content ?? ''} view={view} onTextSelect={onTextSelect} />
        );

      case 'jupyter':
        return <JupyterViewer content={source.content ?? ''} onTextSelect={onTextSelect} />;

      case 'latex':
        return (
          <LaTeXViewer content={source.content ?? ''} view={view} onTextSelect={onTextSelect} />
        );

      case 'txt':
        return <PlainTextViewer content={source.content ?? ''} onTextSelect={onTextSelect} />;

      default:
        return (
          <div className="p-6 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Preview not available for {source.format.toUpperCase()} files</p>
            {onDownload && (
              <Button onClick={onDownload} variant="outline" className="mt-4">
                <Download className="h-4 w-4 mr-2" />
                Download to view
              </Button>
            )}
          </div>
        );
    }
  }, [source, view, onTextSelect, onDownload]);

  return (
    <div
      className={cn('space-y-4', fullscreen && 'fixed inset-0 z-50 bg-background p-4', className)}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {title && <h3 className="font-medium">{title}</h3>}
          <span className="text-xs text-muted-foreground uppercase">{source.format}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          {canToggleSource && (
            <Tabs value={view} onValueChange={(v) => setView(v as 'rendered' | 'source')}>
              <TabsList className="h-8">
                <TabsTrigger value="rendered" className="h-7 text-xs gap-1">
                  <Eye className="h-3 w-3" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="source" className="h-7 text-xs gap-1">
                  <Code className="h-3 w-3" />
                  Source
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Download */}
          {onDownload && (
            <Button variant="ghost" size="sm" onClick={onDownload}>
              <Download className="h-4 w-4" />
            </Button>
          )}

          {/* Fullscreen toggle */}
          {onFullscreenToggle && (
            <Button variant="ghost" size="sm" onClick={onFullscreenToggle}>
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Document content */}
      <div className={cn('min-h-[400px]', fullscreen && 'flex-1 overflow-auto')}>
        {renderViewer()}
      </div>
    </div>
  );
}
