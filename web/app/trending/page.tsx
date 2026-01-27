'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Clock, Eye, ArrowUp, User } from 'lucide-react';

import { useTrending } from '@/lib/hooks/use-trending';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextRenderer } from '@/components/editor/rich-text-renderer';

type TimeWindow = '24h' | '7d' | '30d';

const windowLabels: Record<TimeWindow, string> = {
  '24h': 'Today',
  '7d': 'This Week',
  '30d': 'This Month',
};

/**
 * Trending eprints page.
 *
 * @remarks
 * Shows popular eprints based on views within configurable time windows.
 * Designed for discovery and exploring active topics.
 */
export default function TrendingPage() {
  const [window, setWindow] = useState<TimeWindow>('7d');

  const { data, isLoading, error } = useTrending({
    window,
    limit: 25,
  });

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Trending
          </h1>
          <p className="text-muted-foreground">
            Most popular eprints based on community engagement
          </p>
        </div>
      </div>

      {/* Time Window Selector */}
      <Tabs value={window} onValueChange={(v) => setWindow(v as TimeWindow)}>
        <TabsList>
          <TabsTrigger value="24h" className="gap-2">
            <Clock className="h-4 w-4" />
            Today
          </TabsTrigger>
          <TabsTrigger value="7d" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            This Week
          </TabsTrigger>
          <TabsTrigger value="30d" className="gap-2">
            <ArrowUp className="h-4 w-4" />
            This Month
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Results */}
      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive">Failed to load trending eprints</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : data?.trending && data.trending.length > 0 ? (
        <div className="space-y-4">
          {data.trending.map((eprint, index) => (
            <Link
              key={eprint.uri}
              href={`/eprints/${encodeURIComponent(eprint.uri)}`}
              className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Rank Badge */}
                <div className="flex flex-col items-center justify-center w-12 shrink-0">
                  <span className="text-2xl font-bold text-muted-foreground">
                    #{eprint.rank ?? index + 1}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {eprint.fields?.slice(0, 2).map((field) => (
                      <Badge key={field.uri} variant="outline" className="text-xs">
                        {field.label}
                      </Badge>
                    ))}
                  </div>

                  <h3 className="font-semibold mt-1 line-clamp-2">
                    <RichTextRenderer items={eprint.titleItems} mode="inline" />
                  </h3>

                  <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    <RichTextRenderer items={eprint.abstractItems} mode="inline" />
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {eprint.authors.map((a) => a.name).join(', ') || 'Unknown Author'}
                    </span>
                    <span>{new Date(eprint.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Views Stats */}
                <div className="shrink-0 text-right">
                  <div className="flex items-center gap-1 text-sm font-medium text-primary">
                    <Eye className="h-4 w-4" />
                    {eprint.viewsInWindow.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    views {windowLabels[window].toLowerCase()}
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {data.hasMore && (
            <div className="text-center py-4">
              <Button variant="outline">Load More</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No trending eprints</h3>
          <p className="mt-2 text-sm text-muted-foreground">Check back later for popular content</p>
        </div>
      )}
    </div>
  );
}
