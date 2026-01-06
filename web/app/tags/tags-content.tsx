'use client';

/**
 * Tags page content component.
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingTags, TagCloud, TagCloudSkeleton, TagList } from '@/components/tags';
import { useTrendingTags, useTagSearch } from '@/lib/hooks/use-tags';

/**
 * Main content for tags browse page.
 */
export function TagsPageContent() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: trendingData, isLoading: trendingLoading } = useTrendingTags('month');

  const { data: searchData, isLoading: searchLoading } = useTagSearch(
    searchQuery,
    {},
    { enabled: searchQuery.length >= 2 }
  );

  const showSearchResults = searchQuery.length >= 2;
  const searchResults = searchData?.tags ?? [];

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Search results */}
      {showSearchResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search results</CardTitle>
          </CardHeader>
          <CardContent>
            {searchLoading ? (
              <p className="text-sm text-muted-foreground">Searching...</p>
            ) : searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tags found for &quot;{searchQuery}&quot;
              </p>
            ) : (
              <TagList tags={searchResults} layout="wrap" linkToTags showCounts />
            )}
          </CardContent>
        </Card>
      )}

      {/* Trending tags */}
      {!showSearchResults && <TrendingTags limit={20} timeWindow="week" linkToTags />}

      {/* All tags cloud */}
      {!showSearchResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All tags</CardTitle>
          </CardHeader>
          <CardContent>
            {trendingLoading ? (
              <TagCloudSkeleton count={30} />
            ) : trendingData?.tags ? (
              <TagCloud tags={trendingData.tags} linkToTags />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No tags yet</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
