/**
 * Dedicated citation network view for a single eprint.
 *
 * @remarks
 * The eprint page's Network tab lists citations as text. This route is where
 * the interactive graph lives, since a force-directed network needs more room
 * than a tab panel gives it.
 *
 * The AT-URI arrives as one percent-encoded path segment, so the route mirrors
 * `/eprints/edit/[...uri]` rather than nesting under `/eprints/[...uri]`: a
 * catch-all has to be the last part of a Next.js route, and a segment after one
 * throws at build time.
 *
 * @packageDocumentation
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { CitationVisualization } from '@/components/eprints/citation-visualization';
import { createServerClient } from '@/lib/api/client';
import type { Record as SubmissionRecord } from '@/lib/api/generated/types/pub/chive/eprint/submission';

/**
 * Citation network route parameters.
 */
interface CitationNetworkPageProps {
  params: Promise<{
    uri: string[];
  }>;
}

/**
 * Reconstructs the AT-URI from the catch-all segments.
 *
 * @param segments - Path segments as Next.js parsed them
 * @returns The decoded AT-URI
 *
 * @remarks
 * Callers encode the whole URI with `encodeURIComponent`, so it usually arrives
 * as a single segment; joining first handles a client that did not.
 */
function toAtUri(segments: string[]): string {
  return decodeURIComponent(segments.join('/'));
}

/**
 * Titles the page after the paper whose network it draws.
 */
export async function generateMetadata({ params }: CitationNetworkPageProps): Promise<Metadata> {
  const { uri } = await params;
  const fullUri = toAtUri(uri);

  try {
    const serverApi = createServerClient();
    const response = await serverApi.pub.chive.eprint.getSubmission({ uri: fullUri });
    const value = response.data.value as SubmissionRecord;
    return { title: `Citation network: ${value.title}` };
  } catch {
    return { title: 'Citation network' };
  }
}

/**
 * Citation network page.
 *
 * @param props - Route props carrying the eprint's AT-URI
 * @returns The interactive citation graph for that eprint
 */
export default async function CitationNetworkPage({ params }: CitationNetworkPageProps) {
  const { uri } = await params;
  const fullUri = toAtUri(uri);

  if (!fullUri.startsWith('at://')) {
    notFound();
  }

  // Best-effort: the graph is worth drawing even when the title lookup fails.
  let title: string | undefined;
  try {
    const serverApi = createServerClient();
    const response = await serverApi.pub.chive.eprint.getSubmission({ uri: fullUri });
    title = (response.data.value as SubmissionRecord).title;
  } catch {
    title = undefined;
  }

  return (
    <div className="space-y-6 py-8">
      <div className="min-w-0">
        <Link
          href={`/eprints/${encodeURIComponent(fullUri)}`}
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to eprint
        </Link>
        <h1 className="text-3xl font-bold">Citation network</h1>
        {title ? <p className="mt-2 text-muted-foreground">{title}</p> : null}
      </div>

      <CitationVisualization eprintUri={fullUri} height="70vh" />
    </div>
  );
}
