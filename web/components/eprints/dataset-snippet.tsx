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
 * A link names its data as a catalog collection, as a corpus, or not at all.
 * `pub.layers.catalog.collection` is the dataset as a whole and is the general
 * case -- a dataset built from expressions and judgments has no corpus record,
 * so a snippet that could only load a corpus would have nothing to offer it.
 * Each has its own loader in `lairs`, so the snippet follows whichever ref the
 * link carries, preferring the collection when it has both: that is the
 * artifact the reader means by "the dataset".
 *
 * A link with neither ref records that data exists somewhere without saying
 * which record holds it. No snippet is shown then, because one pointing at the
 * link record rather than at the data would not run.
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
  /** AT-URI of the `pub.layers.catalog.collection` for the dataset */
  catalogRef?: string;
  /** AT-URI of the `pub.layers.corpus.corpus`, when the dataset is a corpus */
  corpusRef?: string;
  /** Additional class names */
  className?: string;
}

/**
 * The PDS `lairs` reads public Layers records from.
 *
 * @remarks
 * Layers serves `repo.layers.pub`, `repo.decomp.io` and `repo.megaattitude.io`
 * from one host, and every Layers repo records this endpoint in its DID
 * document whichever domain its handle sits on. One endpoint therefore reaches
 * a dataset's accounts even though a dataset is split across one account per
 * record type.
 */
const LAYERS_PDS = 'https://repo.layers.pub';

/**
 * Builds the snippet for whichever record the link names.
 *
 * @param ref - The AT-URI to load
 * @param kind - Which loader the URI needs
 * @returns Runnable Python
 *
 * @remarks
 * Both loaders take the same keyword arguments and both need an injected
 * `pds_client`: without one they raise `NotImplementedError` rather than
 * resolving the endpoint themselves.
 */
function snippetFor(ref: string, kind: 'collection' | 'corpus'): string {
  const loader = kind === 'collection' ? 'load_collection' : 'load_corpus';
  const module = kind === 'collection' ? 'lairs.data.collection' : 'lairs.data.corpus';
  const binding = kind === 'collection' ? 'dataset' : 'corpus';

  return `from ${module} import ${loader}
from lairs.atproto import PdsClient

with PdsClient("${LAYERS_PDS}") as client:
    ${binding} = ${loader}(
        "${ref}",
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
export function DatasetSnippet({ catalogRef, corpusRef, className }: DatasetSnippetProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // The collection is the dataset a reader means; the corpus is one part of it.
  const ref = catalogRef ?? corpusRef;
  const code = ref ? snippetFor(ref, catalogRef ? 'collection' : 'corpus') : null;

  if (!code) {
    return null;
  }

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
