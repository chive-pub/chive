'use client';

/**
 * Expandable error details component for debugging.
 *
 * @remarks
 * Shows technical error information in a collapsible panel.
 * Only intended for use in development mode.
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ChiveError } from '@/lib/errors';

/**
 * Props for the ErrorDetails component.
 */
export interface ErrorDetailsProps {
  /** Error to display details for */
  error: Error;
  /** Whether details are initially expanded */
  defaultExpanded?: boolean;
}

/**
 * Expandable error details for debugging.
 *
 * @example
 * ```tsx
 * {isDev && <ErrorDetails error={error} defaultExpanded />}
 * ```
 */
export function ErrorDetails({ error, defaultExpanded = false }: ErrorDetailsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const errorJson =
    error instanceof ChiveError
      ? JSON.stringify(error.toJSON(), null, 2)
      : JSON.stringify(
          {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          null,
          2
        );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(errorJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className="rounded-md border border-destructive/20 bg-destructive/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-3 text-left text-sm font-medium text-destructive/80 hover:text-destructive"
      >
        <span>Debug Details</span>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="border-t border-destructive/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Error JSON</span>
            <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-2 text-xs">
              {copied ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
            <code>{errorJson}</code>
          </pre>

          {error.stack && (
            <>
              <span className="mt-4 block text-xs font-medium text-muted-foreground">
                Stack Trace
              </span>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-3 text-xs">
                <code>{error.stack}</code>
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
