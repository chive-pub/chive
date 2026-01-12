'use client';

import { Link2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useBacklinks,
  useBacklinkCounts,
  getSourceTypeLabel,
  type BacklinkSourceType,
} from '@/lib/hooks/use-backlinks';

import { BacklinkItem } from './backlink-item';

export interface BacklinksPanelProps {
  eprintUri: string;
  className?: string;
  /** Maximum number of backlinks to show initially */
  initialLimit?: number;
}

/**
 * Skeleton loader for backlinks panel.
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
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 mt-0.5" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Source type section within the backlinks panel.
 */
function BacklinkSection({
  sourceType,
  eprintUri,
  initialExpanded = false,
}: {
  sourceType: BacklinkSourceType;
  eprintUri: string;
  initialExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initialExpanded);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useBacklinks(
    eprintUri,
    {
      sourceType,
      limit: 5,
      enabled: expanded,
    }
  );

  const backlinks = data?.pages.flatMap((p) => p.backlinks) ?? [];
  const label = getSourceTypeLabel(sourceType);

  return (
    <div className="border-t pt-3 first:border-t-0 first:pt-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <span className="text-sm font-medium">{label}</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : backlinks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No backlinks from this source</p>
          ) : (
            <>
              {backlinks.map((backlink) => (
                <BacklinkItem key={backlink.id} backlink={backlink} />
              ))}
              {hasNextPage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="w-full mt-2"
                >
                  {isFetchingNextPage ? 'Loading...' : 'Load more'}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Displays backlinks to a eprint from external sources.
 *
 * @remarks
 * Shows references to this eprint from Semble collections, Bluesky posts,
 * WhiteWind blogs, and Leaflet lists. Includes counts by source type.
 *
 * @example
 * ```tsx
 * <BacklinksPanel eprintUri="at://did:plc:abc/pub.chive.eprint.submission/123" />
 * ```
 */
export function BacklinksPanel({ eprintUri, className }: BacklinksPanelProps) {
  const { data: counts, isLoading: countsLoading } = useBacklinkCounts(eprintUri);

  // Determine which source types have backlinks
  const sourcesWithBacklinks: BacklinkSourceType[] = [];
  if (counts) {
    if (counts.sembleCollections > 0) sourcesWithBacklinks.push('semble.collection');
    if (counts.blueskyPosts > 0) sourcesWithBacklinks.push('bluesky.post');
    if (counts.blueskyEmbeds > 0) sourcesWithBacklinks.push('bluesky.embed');
    if (counts.whitewindBlogs > 0) sourcesWithBacklinks.push('whitewind.blog');
    if (counts.leafletLists > 0) sourcesWithBacklinks.push('leaflet.list');
    if (counts.other > 0) sourcesWithBacklinks.push('other');
  }

  const hasBacklinks = counts && counts.total > 0;

  if (countsLoading) {
    return <BacklinksPanelSkeleton className={className} />;
  }

  if (!hasBacklinks) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Backlinks
          <Badge variant="secondary" className="ml-auto" data-testid="backlinks-count">
            {counts.total}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sourcesWithBacklinks.map((sourceType) => (
          <BacklinkSection
            key={sourceType}
            sourceType={sourceType}
            eprintUri={eprintUri}
            initialExpanded={false}
          />
        ))}
      </CardContent>
    </Card>
  );
}
