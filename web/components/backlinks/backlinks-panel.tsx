'use client';

/**
 * Where a paper has been referred to across the atmosphere.
 *
 * @remarks
 * This panel used to be a stack of collapsed accordions, one per source type,
 * each of which fetched its own page only once a reader thought to open it.
 * That buried the thing it exists to show. Worse, the sections came from the
 * counts endpoint, which buckets five ways and files everything else under
 * `other` -- so a talk, a standard.site document and a Margin annotation all
 * hid behind a heading that named none of them.
 *
 * It is now a flat list, loaded at once and filtered by the application that
 * published each record, which is read from the record's own collection rather
 * than from Chive's coarser classification. A reader arriving at the tab sees
 * the references themselves.
 *
 * @packageDocumentation
 */

import { Link2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeAtUri } from '@/lib/atproto/at-uri-links';
import { useBacklinks, useBacklinkCounts, type Backlink } from '@/lib/hooks/use-backlinks';

import { BacklinkItem, getSourceLabel } from './backlink-item';

export interface BacklinksPanelProps {
  eprintUri: string;
  className?: string;
  /**
   * Say so when there is nothing, rather than rendering nothing.
   *
   * @remarks
   * On a tab of its own an empty panel would leave a blank page, and a reader
   * cannot tell a paper with no references from a panel that failed to load.
   * Inside a page that has other content, staying silent is still right.
   */
  showEmpty?: boolean;
}

/**
 * Skeleton loader for the panel.
 *
 * @param props - Component props
 * @returns The placeholder
 *
 * @public
 */
export function BacklinksPanelSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Backlinks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Which application published a reference.
 *
 * @param backlink - The reference
 * @returns The application's name
 */
function appNameOf(backlink: Backlink): string {
  return describeAtUri(backlink.sourceUri)?.appName ?? getSourceLabel(backlink.sourceType);
}

/**
 * Displays references to an eprint from elsewhere on the network.
 *
 * @param props - Component props
 * @returns The panel
 *
 * @public
 */
export function BacklinksPanel({ eprintUri, className, showEmpty = false }: BacklinksPanelProps) {
  const { data: counts } = useBacklinkCounts(eprintUri);
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useBacklinks(
    eprintUri,
    { limit: 20 }
  );

  const [app, setApp] = useState<string | null>(null);

  const backlinks = useMemo(() => data?.pages.flatMap((p) => p.backlinks) ?? [], [data]);

  // Chips are counted over what has been loaded, which is what they filter.
  // Counting them from the totals endpoint would promise a filter that then
  // showed fewer rows than its own label.
  const apps = useMemo(() => {
    const tally = new Map<string, number>();
    for (const backlink of backlinks) {
      const name = appNameOf(backlink);
      tally.set(name, (tally.get(name) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [backlinks]);

  const shown = app ? backlinks.filter((b) => appNameOf(b) === app) : backlinks;

  if (isLoading) {
    return <BacklinksPanelSkeleton className={className} />;
  }

  const total = counts?.total ?? backlinks.length;

  if (total === 0) {
    if (!showEmpty) return null;
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Atmosphere
          </CardTitle>
          <CardDescription>
            Nothing on the network refers to this paper yet. When someone collects it on Cosmik,
            writes about it on Leaflet, annotates it in Margin, schedules a talk about it, or
            publishes it through standard.site, the record appears here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Atmosphere
          <Badge variant="secondary" className="ml-auto" data-testid="backlinks-count">
            {total}
          </Badge>
        </CardTitle>
        <CardDescription>
          Records elsewhere on the network that refer to this paper. Each one lives in its
          author&apos;s own repository, not in Chive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {apps.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by application">
            <Button
              variant={app === null ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 rounded-full px-3 text-xs"
              aria-pressed={app === null}
              onClick={() => {
                setApp(null);
              }}
            >
              All {backlinks.length}
            </Button>
            {apps.map(([name, count]) => (
              <Button
                key={name}
                variant={app === name ? 'secondary' : 'outline'}
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                aria-pressed={app === name}
                onClick={() => {
                  setApp(app === name ? null : name);
                }}
              >
                {name} {count}
              </Button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {shown.map((backlink) => (
            <BacklinkItem key={backlink.id} backlink={backlink} />
          ))}
        </div>

        {hasNextPage && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
