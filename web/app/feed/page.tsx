'use client';

/**
 * One feed for everything a reader follows.
 *
 * @remarks
 * Following an author creates a collection, so "everything I follow" and
 * "every collection I hold" are the same question asked at different widths.
 * The scope control is that width: subscriptions alone, every collection the
 * reader owns, collections other people own that they follow, or all of it.
 *
 * Deduplication happens on the server. An author held in three collections
 * produces one row here, attributed to all three, because merging in the
 * browser could not collapse two rows that are the same event and would break
 * paging besides.
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import Link from 'next/link';
import { Rss, Library } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FeedEventList } from '@/components/collection/collection-feed';
import { AUTHOR_ACTIVITY_TYPES } from '@/components/subscription/use-author-subscription';
import { useIsAuthenticated } from '@/lib/auth';
import { useFollowedFeed } from '@/lib/hooks/use-collections';

type Scope = 'subscriptions' | 'mine' | 'followed' | 'all';

const SCOPES: { id: Scope; label: string; hint: string }[] = [
  { id: 'all', label: 'Everything', hint: 'Collections you own and collections you follow' },
  {
    id: 'subscriptions',
    label: 'Authors I follow',
    hint: 'Only the collections created by following someone',
  },
  {
    id: 'mine',
    label: 'My collections',
    hint: 'Every collection you own, hand-built ones included',
  },
  { id: 'followed', label: 'Collections I follow', hint: 'Collections other people own' },
];

/**
 * The aggregate activity feed page.
 *
 * @returns React element
 */
export default function FeedPage() {
  const isAuthenticated = useIsAuthenticated();
  const [scope, setScope] = useState<Scope>('all');
  const [types, setTypes] = useState<string[]>([]);

  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useFollowedFeed({ scope, types, enabled: isAuthenticated });

  const events = data?.pages.flatMap((p) => p.events) ?? [];

  const toggleType = (id: string): void => {
    setTypes((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id]
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="container py-10">
        <Card className="p-6 text-center">
          <Rss className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">Your feed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to see activity from the authors and collections you follow.
          </p>
          <Button asChild className="mt-4">
            <Link href="/login?returnTo=/feed">Sign in</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Rss className="h-6 w-6" />
          Your feed
        </h1>
        <p className="text-sm text-muted-foreground">
          Activity from everything you follow. Following someone creates a collection, so this is
          the activity of your collections gathered into one place.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Show activity from</p>
            <div className="space-y-1">
              {SCOPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setScope(s.id);
                  }}
                  title={s.hint}
                  aria-pressed={scope === s.id}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    scope === s.id ? 'bg-muted font-medium' : 'hover:bg-muted/60'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Kinds of activity
              {types.length === 0 && <span className="ml-1 font-normal">(all)</span>}
            </p>
            <div className="space-y-2">
              {AUTHOR_ACTIVITY_TYPES.map((t) => (
                <label
                  key={t.id}
                  htmlFor={`feed-type-${t.id}`}
                  className="flex cursor-pointer items-start gap-2"
                >
                  <Checkbox
                    id={`feed-type-${t.id}`}
                    aria-label={t.label}
                    checked={types.includes(t.id)}
                    onCheckedChange={() => {
                      toggleType(t.id);
                    }}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="min-w-0 text-sm leading-tight">{t.label}</span>
                </label>
              ))}
            </div>
            {types.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-auto px-2 py-1 text-xs"
                onClick={() => {
                  setTypes([]);
                }}
              >
                Clear
              </Button>
            )}
          </div>

          <Button variant="outline" size="sm" asChild className="w-full">
            <Link href="/dashboard/collections">
              <Library className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Manage collections</span>
            </Link>
          </Button>
        </aside>

        <section className="min-w-0">
          <FeedEventList
            events={events}
            isLoading={isLoading}
            isError={isError}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={() => void fetchNextPage()}
            emptyMessage={
              scope === 'subscriptions'
                ? 'You are not following anyone yet. Follow an author from their profile.'
                : 'Nothing yet. Follow an author, or add people and papers to a collection.'
            }
          />
        </section>
      </div>
    </div>
  );
}
