'use client';

/**
 * Tag detail page content.
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import Link from 'next/link';
import { FileText, TrendingUp, ChevronRight, Users, Calendar, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTagDetail, useTagEprints } from '@/lib/hooks/use-tags';

/**
 * Props for TagDetailContent.
 */
export interface TagDetailContentProps {
  tag: string;
}

/**
 * Content component for tag detail page.
 */
export function TagDetailContent({ tag }: TagDetailContentProps) {
  const { data: tagSummary, isLoading, error } = useTagDetail(tag);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const {
    data: eprintsData,
    isLoading: eprintsLoading,
    error: eprintsError,
    isFetching: eprintsFetching,
  } = useTagEprints(tag, { cursor });

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Failed to load tag details</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Card>
          <CardContent className="py-6">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tagSummary) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Tag not found</p>
      </div>
    );
  }

  const hasMoreEprints = eprintsData?.cursor !== undefined;

  return (
    <div className="space-y-6">
      {/* Tag stats */}
      <div className="flex flex-wrap gap-4">
        <Badge variant="secondary" className="gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          {tagSummary.usageCount} eprint{tagSummary.usageCount !== 1 ? 's' : ''}
        </Badge>
        {tagSummary.isPromoted && tagSummary.promotedTo && (
          <Badge variant="outline" className="gap-1.5 capitalize">
            <TrendingUp className="h-3.5 w-3.5" />
            Promoted to {tagSummary.promotedTo.type}
          </Badge>
        )}
      </div>

      {/* Tag quality info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tag Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            <p className="text-muted-foreground">Quality Score</p>
            <p className="font-medium">{tagSummary.qualityScore}%</p>
          </div>
        </CardContent>
      </Card>

      {/* Eprints with this tag */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Eprints with this tag
            {eprintsData && (
              <span className="text-muted-foreground font-normal ml-2">({eprintsData.total})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eprintsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : eprintsError ? (
            <p className="text-destructive text-sm">Failed to load eprints</p>
          ) : eprintsData?.eprints.length === 0 ? (
            <p className="text-muted-foreground text-sm">No eprints found with this tag.</p>
          ) : (
            <div className="space-y-4">
              {eprintsData?.eprints.map((eprint) => (
                <div
                  key={eprint.uri}
                  className="group border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <Link
                    href={`/eprints/${encodeURIComponent(eprint.uri)}`}
                    className="block hover:bg-muted/50 -mx-2 px-2 py-2 rounded-md transition-colors"
                  >
                    <h3 className="font-medium text-foreground group-hover:text-primary line-clamp-2">
                      {eprint.title}
                    </h3>
                    {eprint.authors && eprint.authors.length > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <Users className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="line-clamp-1">
                          {eprint.authors.map((a) => a.name).join(', ')}
                        </span>
                      </div>
                    )}
                    {eprint.abstract && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {eprint.abstract}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {eprint.createdAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(eprint.createdAt).toLocaleDateString()}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-primary group-hover:underline">
                        View eprint
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                </div>
              ))}

              {/* Pagination */}
              {hasMoreEprints && (
                <div className="pt-4 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCursor(eprintsData?.cursor)}
                    disabled={eprintsFetching}
                  >
                    {eprintsFetching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load more eprints'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
