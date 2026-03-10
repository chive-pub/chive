'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Clock, Eye, ArrowUp, User, Sparkles, Bookmark, Settings } from 'lucide-react';

import { useCurrentUser } from '@/lib/auth';
import { useAuthorProfile } from '@/lib/hooks/use-author';
import { useDiscoverySettings } from '@/lib/hooks/use-discovery';
import { useTrending } from '@/lib/hooks/use-trending';
import { useMutedAuthors, filterMutedContent } from '@/lib/hooks/use-muted-authors';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextRenderer } from '@/components/editor/rich-text-renderer';
import type { RichTextItem } from '@/lib/types/rich-text';
import type { TrendingEntry } from '@/lib/api/schema';

type TimeWindow = '24h' | '7d' | '30d';
type FieldTab = 'my-fields' | 'following';

const windowLabels: Record<TimeWindow, string> = {
  '24h': 'Today',
  '7d': 'This Week',
  '30d': 'This Month',
};

/**
 * Renders a single trending eprint card.
 *
 * @param eprint - The trending entry data
 * @param index - The position index in the list
 * @param window - The current time window
 */
function TrendingCard({
  eprint,
  index,
  window,
}: {
  eprint: TrendingEntry;
  index: number;
  window: TimeWindow;
}) {
  return (
    <Link
      key={eprint.uri}
      href={`/eprints/${encodeURIComponent(eprint.uri)}`}
      className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start gap-4">
        {/* Rank Badge */}
        <div className="flex flex-col items-center justify-center w-12 shrink-0">
          <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
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
            <RichTextRenderer text={eprint.title} mode="inline" />
          </h3>

          <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
            <RichTextRenderer items={eprint.abstract as RichTextItem[]} mode="inline" />
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
  );
}

/**
 * Trending eprints page.
 *
 * @remarks
 * Shows popular eprints filtered by the user's fields across two tabs:
 * - "My Fields" shows trending papers matching the user's work fields (from profile)
 * - "Following" shows trending papers matching fields the user follows for discovery
 *
 * If the user has no fields set, shows a prompt to configure their profile.
 */
export default function TrendingPage() {
  const user = useCurrentUser();
  const { data: profile } = useAuthorProfile(user?.did ?? '');
  const { data: discoverySettings } = useDiscoverySettings();

  const defaultWindow = (discoverySettings?.trendingPreferences?.defaultWindow ??
    '7d') as TimeWindow;
  const defaultLimit = discoverySettings?.trendingPreferences?.defaultLimit ?? 20;

  const [window, setWindow] = useState<TimeWindow>(defaultWindow);
  const [fieldTab, setFieldTab] = useState<FieldTab>('my-fields');
  const [initialized, setInitialized] = useState(false);

  // Sync initial window from settings once loaded
  if (discoverySettings && !initialized) {
    setWindow(defaultWindow);
    setInitialized(true);
  }

  const personalizationEnabled = discoverySettings?.enablePersonalization !== false;

  // Work fields from profile
  const workFieldUris = profile?.fields;
  const hasWorkFields = !!workFieldUris && workFieldUris.length > 0 && personalizationEnabled;

  // Followed fields from discovery settings
  const followedFieldUris = discoverySettings?.followedFieldUris;
  const includeWorkFields = discoverySettings?.followingTabIncludesWorkFields ?? false;
  const hasFollowedFields = !!followedFieldUris && followedFieldUris.length > 0;

  // Merge followed fields with work fields if the setting is enabled
  const mergedFollowingUris = useMemo(() => {
    if (!hasFollowedFields && !includeWorkFields) return undefined;
    const uris = new Set<string>(followedFieldUris ?? []);
    if (includeWorkFields && workFieldUris) {
      for (const uri of workFieldUris) {
        uris.add(uri);
      }
    }
    return uris.size > 0 ? Array.from(uris) : undefined;
  }, [followedFieldUris, hasFollowedFields, includeWorkFields, workFieldUris]);

  // Determine which field URIs to pass based on active tab
  const activeFieldUris = fieldTab === 'my-fields' ? workFieldUris : mergedFollowingUris;
  const hasActiveFields = !!activeFieldUris && activeFieldUris.length > 0;

  const { data, isLoading, error } = useTrending({
    window,
    limit: defaultLimit,
    ...(hasActiveFields ? { fieldUris: activeFieldUris } : {}),
  });
  const { mutedDids } = useMutedAuthors();

  // Filter to only show entries matching the active fields, excluding muted authors
  const displayEntries = useMemo(() => {
    let entries = data?.trending ?? [];
    if (hasActiveFields) {
      entries = entries.filter((entry) => entry.inUserFields);
    }
    return filterMutedContent(
      entries,
      mutedDids,
      (entry) => entry.authors?.map((a) => a.did).filter((d): d is string => !!d) ?? []
    );
  }, [data?.trending, hasActiveFields, mutedDids]);

  const isAuthenticated = !!user;

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-8 w-8" />
          Trending
        </h1>
        <p className="text-muted-foreground">Most popular eprints based on community engagement</p>
      </div>

      {/* Field Tab Selector (only for authenticated users with personalization on) */}
      {isAuthenticated && personalizationEnabled && (
        <Tabs value={fieldTab} onValueChange={(v) => setFieldTab(v as FieldTab)}>
          <TabsList>
            <TabsTrigger value="my-fields" className="gap-2">
              <Sparkles className="h-4 w-4" />
              My Fields
            </TabsTrigger>
            <TabsTrigger value="following" className="gap-2">
              <Bookmark className="h-4 w-4" />
              Following
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

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
      ) : !hasActiveFields ? (
        // No fields configured for the active tab
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          {fieldTab === 'my-fields' ? (
            <>
              <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Set your research fields</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add research fields to your profile to see trending papers in your areas.
              </p>
              <Link href="/dashboard/settings">
                <Button variant="outline" className="mt-4 gap-2">
                  <Settings className="h-4 w-4" />
                  Go to Settings
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Bookmark className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Follow fields to discover papers</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Follow fields in your discovery settings to track trending papers outside your own
                research areas.
              </p>
              <Link href="/dashboard/settings">
                <Button variant="outline" className="mt-4 gap-2">
                  <Settings className="h-4 w-4" />
                  Discovery Settings
                </Button>
              </Link>
            </>
          )}
        </div>
      ) : displayEntries.length > 0 ? (
        <div className="space-y-4">
          {displayEntries.map((eprint, index) => (
            <TrendingCard key={eprint.uri} eprint={eprint} index={index} window={window} />
          ))}

          {data?.hasMore && (
            <div className="text-center py-4">
              <Button variant="outline">Load More</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">
            {fieldTab === 'my-fields'
              ? 'No trending eprints in your fields'
              : 'No trending eprints in followed fields'}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Check back later for popular content in{' '}
            {fieldTab === 'my-fields' ? 'your research areas' : 'the fields you follow'}
          </p>
        </div>
      )}
    </div>
  );
}
