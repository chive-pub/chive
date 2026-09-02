'use client';

/**
 * Shows how to load a linked dataset with `lairs`.
 *
 * @remarks
 * A dataset linked from Layers is addressed by an AT-URI, which tells a reader
 * the data exists but not how to open it. `lairs` is the Python client for the
 * Layers format — it pulls `pub.layers.*` records from a PDS and exposes them
 * through a `datasets`-like API — so the shortest path from "this paper has a
 * corpus" to "I have the corpus" is the four lines below with the right URI
 * already in them.
 *
 * The snippet is shown only for a link that names a corpus. A data link
 * without a `corpusRef` records that data exists somewhere without saying
 * which record holds it, and a snippet pointing at the link record rather than
 * the corpus would not run.
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import { Check, Copy, Code2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Props for {@link DatasetSnippet}.
 *
 * @public
 */
export interface DatasetSnippetProps {
  /** AT-URI of the Layers corpus */
  corpusRef: string;
  /** Additional class names */
  className?: string;
}

/**
 * The PDS `lairs` reads public Layers records from.
 */
const LAYERS_PDS = 'https://repo.layers.pub';

/**
 * Builds the snippet for one corpus.
 */
function snippetFor(corpusRef: string): string {
  return `import lairs
from lairs.atproto import PdsClient

with PdsClient("${LAYERS_PDS}") as client:
    corpus = lairs.load_corpus(
        "${corpusRef}",
        source="pds",
        pds_client=client,
    )`;
}

/**
 * A copyable snippet that loads the dataset.
 *
 * @param props - Component props
 * @returns A disclosure containing the snippet
 *
 * @public
 */
export function DatasetSnippet({ corpusRef, className }: DatasetSnippetProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const code = snippetFor(corpusRef);

  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  };

  return (
    <div className={cn('mt-2', className)}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Code2 className="h-3.5 w-3.5" />
        {open ? 'Hide code' : 'Load in Python'}
      </button>

      {open && (
        <div className="mt-2 rounded-md border bg-muted/50">
          <div className="flex items-center justify-between border-b px-3 py-1.5">
            <span className="text-xs text-muted-foreground">
              lairs · <code>pip install lairs</code>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={copy}
              className="h-7 gap-1 text-xs"
              aria-label="Copy code to load this dataset"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          {/* A long AT-URI must not push the page sideways. */}
          <pre className="overflow-x-auto p-3 text-xs">
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
