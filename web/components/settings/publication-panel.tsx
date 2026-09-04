'use client';

/**
 * Manage the publication readers subscribe to.
 *
 * @remarks
 * A `site.standard.publication` is the thing a reader follows: it carries the
 * name and description shown on a link card anywhere in the standard.site
 * ecosystem, and every eprint document points at it.
 *
 * It lives in the author's own repository. Chive can neither create nor edit
 * one on their behalf, which is why this exists rather than a setting Chive
 * stores.
 *
 * The url is deliberately not editable. It is what a publication is matched on,
 * and what existing subscriptions were written against — changing it would
 * orphan every subscriber and mint a second publication on the next write.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';
import { Rss, Loader2, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAgent, useCurrentUser } from '@/lib/auth';
import {
  createPublication,
  findPublication,
  publicationUrlFor,
  updatePublication,
} from '@/lib/atproto/subscription-records';

/**
 * Publication settings for the signed-in author.
 *
 * @returns The panel, or null when nobody is signed in
 *
 * @public
 */
export function PublicationPanel() {
  const agent = useAgent();
  const currentUser = useCurrentUser();

  const [uri, setUri] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const defaultName = currentUser?.displayName ?? currentUser?.handle ?? '';

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (!agent || !currentUser?.did) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const url = publicationUrlFor(currentUser.did);
        const existing = await findPublication(agent, url);
        if (cancelled) return;

        if (existing) {
          setUri(existing);
          const record = await agent.com.atproto.repo.getRecord({
            repo: currentUser.did,
            collection: 'site.standard.publication',
            rkey: existing.split('/').pop() ?? '',
          });
          if (cancelled) return;

          const value = record.data.value as { name?: unknown; description?: unknown };
          setName(typeof value.name === 'string' ? value.name : '');
          setDescription(typeof value.description === 'string' ? value.description : '');
        } else {
          setName(defaultName);
        }
      } catch {
        // The panel should still render; the author can create one.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [agent, currentUser?.did, defaultName]);

  const save = useCallback(async () => {
    if (!agent || !currentUser?.did || isSaving) return;

    setIsSaving(true);
    setError(undefined);
    setSaved(false);

    try {
      if (uri) {
        await updatePublication(agent, uri, { name, description });
      } else {
        const created = await createPublication(agent, {
          name,
          url: publicationUrlFor(currentUser.did),
          description,
        });
        setUri(created.uri);
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the publication');
    } finally {
      setIsSaving(false);
    }
  }, [agent, currentUser?.did, isSaving, uri, name, description]);

  if (!currentUser) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rss className="h-5 w-5" />
          Publication
        </CardTitle>
        <CardDescription>
          What readers subscribe to when they follow your papers. It lives in your own repository
          and carries the name shown on link cards across the standard.site ecosystem.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-3 w-3 animate-spin" />
            Reading your repository…
          </p>
        ) : (
          <>
            {!uri && (
              <p className="text-sm text-muted-foreground">
                You do not have one yet. Readers cannot subscribe to your papers until you do.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="publication-name">Name</Label>
              <Input
                id="publication-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                placeholder={defaultName}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="publication-description">Description</Label>
              <Textarea
                id="publication-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setSaved(false);
                }}
                rows={3}
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" onClick={() => void save()} disabled={isSaving || !name.trim()}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {uri ? 'Save changes' : 'Create publication'}
              </Button>

              {saved && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-green-600" />
                  Saved
                </span>
              )}
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
