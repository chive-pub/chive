'use client';

/**
 * Publish or refresh an eprint's standard.site document.
 *
 * @remarks
 * A `site.standard.document` is what lets a reader outside Chive find a paper:
 * standard.site readers, link cards, feeds. It is written into the author's own
 * repository, so only they can create one — Chive cannot do it on their behalf.
 *
 * The submission wizard offers to write one, but an author may decline, and
 * every paper submitted before that offer existed has none. Both arrive at the
 * same place: an eprint whose author would have to resubmit it to become
 * discoverable. This is the way back.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';
import { Globe, Check, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAgent, useCurrentUser } from '@/lib/auth';
import {
  createStandardDocument,
  findStandardDocumentForEprint,
  updateStandardDocument,
} from '@/lib/atproto/record-creator';
import { ensurePublication } from '@/lib/atproto/subscription-records';

/**
 * Props for {@link StandardDocumentControl}.
 *
 * @public
 */
export interface StandardDocumentControlProps {
  /** AT-URI of the eprint */
  eprintUri: string;
  /** Current title, used when publishing or refreshing */
  title: string;
  /** Current abstract, trimmed into the document's description */
  description?: string;
  /** `compact` suits the quick editor; `full` the sectioned one */
  layout?: 'compact' | 'full';
}

/**
 * What the control knows about the document.
 */
type State =
  | { status: 'loading' }
  | { status: 'absent' }
  | { status: 'present'; uri: string; stale: boolean }
  | { status: 'unavailable' };

/**
 * Lets an author publish or refresh the standard.site document for their eprint.
 *
 * @param props - Component props
 * @returns The control
 *
 * @public
 */
export function StandardDocumentControl({
  eprintUri,
  title,
  description,
  layout = 'full',
}: StandardDocumentControlProps) {
  const agent = useAgent();
  // The publication lives in the signed-in author's repository, so it is named
  // for them rather than for whoever appears first on the paper.
  const currentUser = useCurrentUser();
  const authorName = currentUser?.displayName ?? currentUser?.handle ?? 'Chive';
  const [state, setState] = useState<State>({ status: 'loading' });
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (!agent) {
        if (!cancelled) setState({ status: 'unavailable' });
        return;
      }

      try {
        const existing = await findStandardDocumentForEprint(agent, eprintUri);
        if (cancelled) return;

        if (!existing) {
          setState({ status: 'absent' });
          return;
        }

        // A document whose title no longer matches the eprint is worth
        // refreshing; one that matches needs nothing, and offering an
        // "update" that changes nothing wastes a write and the author's time.
        // Also stale when the document names a bare url. The schema reserves
        // that form for loose documents, and a document that names no
        // publication is one no reader can subscribe to the author from.
        const detached = !existing.site?.startsWith('at://');

        const stale =
          detached ||
          existing.title !== title ||
          (description !== undefined && existing.description !== description);

        setState({ status: 'present', uri: existing.uri, stale });
      } catch {
        if (!cancelled) setState({ status: 'unavailable' });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [agent, eprintUri, title, description]);

  const publish = useCallback(async () => {
    if (!agent || isWorking) return;

    setIsWorking(true);
    setError(undefined);

    try {
      // The publication has to exist before the document can name it, and a
      // document naming a publication is what puts a Subscribe control on the
      // link card. Find-or-create, in the author's own repository.
      const publicationUri = await ensurePublication(agent, authorName);

      if (state.status === 'present') {
        await updateStandardDocument(agent, {
          uri: state.uri,
          title,
          siteUrl: publicationUri,
          ...(description !== undefined ? { description } : {}),
        });
        setState({ status: 'present', uri: state.uri, stale: false });
      } else {
        const created = await createStandardDocument(agent, {
          eprintUri,
          title,
          siteUrl: publicationUri,
          ...(description !== undefined ? { description } : {}),
        });
        setState({ status: 'present', uri: created.uri, stale: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not write the document');
    } finally {
      setIsWorking(false);
    }
  }, [agent, isWorking, state, title, description, eprintUri, authorName]);

  if (state.status === 'loading') {
    return (
      <p className="text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-3 w-3 animate-spin" />
        Checking for a standard.site document…
      </p>
    );
  }

  // Signed out, or the repository could not be read. Saying nothing is better
  // than offering a control that cannot work.
  if (state.status === 'unavailable') {
    return null;
  }

  const published = state.status === 'present';
  const needsWork = !published || state.stale;

  const actionLabel = published ? 'Refresh the document' : 'Publish to standard.site';
  const statusLine = published
    ? state.stale
      ? 'Published, but its title or summary no longer matches this eprint.'
      : 'Published. Readers outside Chive can find this paper.'
    : 'Not published. Readers outside Chive cannot find this paper.';

  return (
    <div className={layout === 'compact' ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-start gap-2">
        {published && !state.stale ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
        ) : (
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <p className="text-sm text-muted-foreground">{statusLine}</p>
      </div>

      {needsWork && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isWorking}
          onClick={() => {
            void publish();
          }}
        >
          {isWorking ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : published ? (
            <RefreshCw className="mr-2 h-4 w-4" />
          ) : (
            <Globe className="mr-2 h-4 w-4" />
          )}
          {actionLabel}
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
