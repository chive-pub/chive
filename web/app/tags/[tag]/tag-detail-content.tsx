'use client';

/**
 * Tag detail page content.
 *
 * @packageDocumentation
 */

import Link from 'next/link';
import { FileText, TrendingUp, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTagDetail } from '@/lib/hooks/use-tags';

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
            <p className="font-medium">{(tagSummary.qualityScore * 100).toFixed(0)}%</p>
          </div>
        </CardContent>
      </Card>

      {/* Browse eprints with this tag */}
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-muted-foreground mb-4">
            Find eprints tagged with &quot;
            {tagSummary.displayForms[0] ?? tagSummary.normalizedForm}&quot;
          </p>
          <Button asChild>
            <Link href={`/browse?tags=${encodeURIComponent(tagSummary.normalizedForm)}`}>
              <Search className="mr-2 h-4 w-4" />
              Browse Eprints
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
