'use client';

/**
 * Batch import dialog for adding multiple items to a collection via DOIs or AT-URIs.
 *
 * @remarks
 * Users paste a list of DOIs or AT-URIs (one per line) into a textarea.
 * The dialog parses each line, resolves DOIs via the CrossRef API, validates
 * AT-URIs, and displays per-line progress. Resolved items can be added to
 * the collection in bulk.
 *
 * @packageDocumentation
 */

import { useState, useCallback, useRef } from 'react';
import { Loader2, Check, XCircle, FileUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { createLogger } from '@/lib/observability/logger';

import type { CollectionItemFormData } from './wizard-steps/types';

const logger = createLogger({ context: { component: 'batch-import-dialog' } });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Status of a single parsed line during batch import.
 */
type LineStatus = 'pending' | 'resolving' | 'resolved' | 'failed';

/**
 * A parsed line with its resolution state.
 */
interface ParsedLine {
  /** Original input text */
  raw: string;
  /** Detected type: 'doi', 'at-uri', or 'unknown' */
  type: 'doi' | 'at-uri' | 'unknown';
  /** Current resolution status */
  status: LineStatus;
  /** Resolved item data (if successful) */
  item?: CollectionItemFormData;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Props for BatchImportDialog.
 */
export interface BatchImportDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to set open state */
  onOpenChange: (open: boolean) => void;
  /** Called with the resolved items when the user clicks "Add all resolved" */
  onImport: (items: CollectionItemFormData[]) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CROSSREF_API_URL = 'https://api.crossref.org/works';
const CROSSREF_POLITE_EMAIL = 'contact@chive.pub';

/** Matches DOI patterns such as "10.1234/something" with optional "https://doi.org/" prefix. */
const DOI_PATTERN = /^(?:https?:\/\/(?:dx\.)?doi\.org\/)?((10\.\d{4,9}\/[^\s]+))$/i;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Classifies a trimmed input line as a DOI, AT-URI, or unknown format.
 *
 * @param line - Trimmed input string
 * @returns The classified type
 */
function classifyLine(line: string): 'doi' | 'at-uri' | 'unknown' {
  if (line.startsWith('at://')) return 'at-uri';
  if (DOI_PATTERN.test(line)) return 'doi';
  return 'unknown';
}

/**
 * Extracts a clean DOI from a line that may include a URL prefix.
 *
 * @param line - Input line
 * @returns The DOI string, or null if no match
 */
function extractDoi(line: string): string | null {
  const match = DOI_PATTERN.exec(line);
  return match?.[1] ?? null;
}

/**
 * Resolves a DOI via the CrossRef API and returns a CollectionItemFormData.
 *
 * @param doi - The DOI to resolve (without URL prefix)
 * @returns Resolved item data
 * @throws When the API request fails or the DOI is not found
 */
async function resolveDoi(doi: string): Promise<CollectionItemFormData> {
  const url = `${CROSSREF_API_URL}/${encodeURIComponent(doi)}?mailto=${CROSSREF_POLITE_EMAIL}`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`DOI not found: ${doi}`);
    }
    throw new Error(`CrossRef API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    message: {
      DOI: string;
      title?: string[];
      author?: Array<{ given?: string; family?: string }>;
      type?: string;
    };
  };

  const title = data.message.title?.[0] ?? 'Untitled';
  const authors = (data.message.author ?? [])
    .map((a) => [a.given, a.family].filter(Boolean).join(' '))
    .filter(Boolean);

  return {
    uri: `doi:${data.message.DOI}`,
    type: 'at-uri',
    label: title,
    metadata: {
      authors: authors.length > 0 ? authors : undefined,
    },
  };
}

/**
 * Validates an AT-URI and returns a CollectionItemFormData.
 *
 * @param uri - The AT-URI string
 * @returns Validated item data
 * @throws When the URI format is invalid
 */
function validateAtUri(uri: string): CollectionItemFormData {
  // Basic AT-URI format: at://did/collection/rkey
  const parts = uri.replace('at://', '').split('/');
  if (parts.length < 2) {
    throw new Error('Invalid AT-URI format: expected at://did/collection/rkey');
  }

  return {
    uri,
    type: 'at-uri',
    label: uri,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Batch import dialog for adding DOIs and AT-URIs in bulk.
 *
 * @param props - Component props
 * @returns Dialog element
 */
export function BatchImportDialog({ open, onOpenChange, onImport }: BatchImportDialogProps) {
  const [rawInput, setRawInput] = useState('');
  const [parsedLines, setParsedLines] = useState<ParsedLine[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const resolvedItems = parsedLines.filter((l) => l.status === 'resolved' && l.item);
  const failedCount = parsedLines.filter((l) => l.status === 'failed').length;

  /**
   * Parses and processes each non-empty line from the textarea.
   */
  const handleParse = useCallback(async () => {
    const lines = rawInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    // Initialize parsed lines
    const initial: ParsedLine[] = lines.map((raw) => ({
      raw,
      type: classifyLine(raw),
      status: 'pending' as const,
    }));
    setParsedLines(initial);
    setIsProcessing(true);

    // Cancel any previous processing
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Process each line sequentially to avoid rate limiting
    for (let i = 0; i < initial.length; i++) {
      if (controller.signal.aborted) break;

      const line = initial[i];

      // Mark as resolving
      setParsedLines((prev) =>
        prev.map((l, idx) => (idx === i ? { ...l, status: 'resolving' as const } : l))
      );

      try {
        let item: CollectionItemFormData;

        if (line.type === 'at-uri') {
          item = validateAtUri(line.raw);
        } else if (line.type === 'doi') {
          const doi = extractDoi(line.raw);
          if (!doi) throw new Error('Could not extract DOI');
          item = await resolveDoi(doi);
        } else {
          throw new Error('Unrecognized format: expected a DOI (10.xxxx/...) or AT-URI (at://...)');
        }

        setParsedLines((prev) =>
          prev.map((l, idx) => (idx === i ? { ...l, status: 'resolved' as const, item } : l))
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('Batch import line failed', { line: line.raw, error: message });
        setParsedLines((prev) =>
          prev.map((l, idx) =>
            idx === i ? { ...l, status: 'failed' as const, error: message } : l
          )
        );
      }
    }

    setIsProcessing(false);
  }, [rawInput]);

  /**
   * Adds all resolved items to the collection and closes the dialog.
   */
  const handleImport = useCallback(() => {
    const items = resolvedItems
      .map((l) => l.item)
      .filter((item): item is CollectionItemFormData => item !== undefined);

    if (items.length > 0) {
      onImport(items);
    }

    // Reset state
    setRawInput('');
    setParsedLines([]);
    onOpenChange(false);
  }, [resolvedItems, onImport, onOpenChange]);

  /**
   * Resets the dialog state for a fresh parse.
   */
  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setParsedLines([]);
    setIsProcessing(false);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Batch Import
          </DialogTitle>
          <DialogDescription>
            Paste DOIs or AT-URIs below, one per line. DOIs will be resolved via CrossRef.
          </DialogDescription>
        </DialogHeader>

        {/* Input phase: show textarea when not yet parsed */}
        {parsedLines.length === 0 && (
          <div className="space-y-3">
            <Textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={[
                '10.1145/3442188.3445922',
                'https://doi.org/10.1038/s41586-021-03819-2',
                'at://did:plc:abc/pub.chive.eprint.submission/123',
              ].join('\n')}
              className="min-h-[160px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Supports bare DOIs (10.xxxx/...), DOI URLs (https://doi.org/...), and AT-URIs
              (at://...).
            </p>
          </div>
        )}

        {/* Results phase: show per-line results after parsing */}
        {parsedLines.length > 0 && (
          <ScrollArea className="max-h-[360px]">
            <div className="space-y-2 pr-4">
              {parsedLines.map((line, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-md border p-3">
                  {/* Status icon */}
                  <div className="mt-0.5 shrink-0">
                    {line.status === 'pending' && (
                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    {line.status === 'resolving' && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {line.status === 'resolved' && <Check className="h-4 w-4 text-green-600" />}
                    {line.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {line.status === 'resolved' && line.item ? (
                      <>
                        <p className="text-sm font-medium truncate">{line.item.label}</p>
                        {line.item.metadata?.authors && line.item.metadata.authors.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {line.item.metadata.authors.join(', ')}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm font-mono truncate">{line.raw}</p>
                    )}
                    {line.status === 'failed' && line.error && (
                      <p className="text-xs text-red-500">{line.error}</p>
                    )}
                  </div>

                  {/* Type badge */}
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {line.type === 'doi' ? 'DOI' : line.type === 'at-uri' ? 'AT-URI' : '?'}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Summary */}
        {parsedLines.length > 0 && !isProcessing && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{resolvedItems.length} resolved</span>
            {failedCount > 0 && <span className="text-red-500">{failedCount} failed</span>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {parsedLines.length === 0 ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="button" onClick={handleParse} disabled={rawInput.trim().length === 0}>
                Parse
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleReset}>
                Back
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={isProcessing || resolvedItems.length === 0}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Add ${resolvedItems.length} item${resolvedItems.length !== 1 ? 's' : ''}`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
