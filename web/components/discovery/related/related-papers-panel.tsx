'use client';

import Link from 'next/link';
import { ExternalLink, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useSimilarPapers, usePrefetchSimilarPapers } from '@/lib/hooks/use-discovery';
import { RelationshipBadge } from './relationship-badge';
import { CitationSummary } from './citation-summary';
import type { RelatedEprint } from '@/lib/api/schema';

/**
 * Props for RelatedPapersPanel component.
 */
export interface RelatedPapersPanelProps {
  /** AT-URI of the source eprint */
  eprintUri: string;
  /** Number of related papers to show */
  limit?: number;
  /** Show citation summary section */
  showCitations?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Panel displaying related papers for a eprint.
 *
 * @remarks
 * Shows papers related by citations, topics, authors, and semantic similarity.
 * Includes a collapsible citation network preview.
 *
 * @example
 * ```tsx
 * <RelatedPapersPanel
 *   eprintUri="at://did:plc:abc/pub.chive.eprint/123"
 *   limit={5}
 *   showCitations
 * />
 * ```
 */
export function RelatedPapersPanel({
  eprintUri,
  limit = 5,
  showCitations = true,
  className,
}: RelatedPapersPanelProps) {
  const { data, isLoading, isError, error } = useSimilarPapers(eprintUri, { limit });

  if (isError) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">
            Failed to load related papers:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Related Papers Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Related Papers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <RelatedPapersListSkeleton count={3} />
          ) : data && data.related.length > 0 ? (
            <div className="space-y-3">
              {data.related.map((paper) => (
                <RelatedPaperCard key={paper.uri} paper={paper} />
              ))}

              {data.related.length >= limit && (
                <Button variant="ghost" size="sm" className="w-full" asChild>
                  <Link href={`/eprints/${encodeURIComponent(eprintUri)}/related`}>
                    View all related papers
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              No related papers found yet. Check back later!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Citation Network Summary */}
      {showCitations && (
        <Card>
          <CitationSummary eprintUri={eprintUri} />
        </Card>
      )}
    </div>
  );
}

/**
 * Props for RelatedPaperCard component.
 */
interface RelatedPaperCardProps {
  paper: RelatedEprint;
  className?: string;
}

/**
 * Individual related paper card with relationship badge.
 */
function RelatedPaperCard({ paper, className }: RelatedPaperCardProps) {
  const prefetch = usePrefetchSimilarPapers();

  return (
    <Link
      href={`/eprints/${encodeURIComponent(paper.uri)}`}
      className={cn(
        'group block rounded-lg border p-3 transition-colors hover:bg-muted/50',
        className
      )}
      onMouseEnter={() => prefetch(paper.uri)}
    >
      <div className="space-y-2">
        {/* Title and badge */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium leading-tight group-hover:underline line-clamp-2">
            {paper.title}
          </h4>
          <RelationshipBadge
            type={paper.relationshipType}
            score={paper.score}
            className="shrink-0"
          />
        </div>

        {/* Authors */}
        {paper.authors && paper.authors.length > 0 && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {paper.authors.map((a) => a.name).join(', ')}
          </p>
        )}

        {/* Publication date and categories */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {paper.publicationDate && <span>{new Date(paper.publicationDate).getFullYear()}</span>}
          {paper.categories && paper.categories.length > 0 && (
            <>
              <span>&middot;</span>
              <span className="truncate">{paper.categories[0]}</span>
            </>
          )}
        </div>

        {/* Explanation */}
        {paper.explanation && (
          <p className="text-xs text-muted-foreground italic line-clamp-1">{paper.explanation}</p>
        )}
      </div>
    </Link>
  );
}

/**
 * Loading skeleton for related papers list.
 */
function RelatedPapersListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      ))}
    </div>
  );
}

/**
 * Full loading skeleton for RelatedPapersPanel.
 */
export function RelatedPapersPanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <RelatedPapersListSkeleton count={3} />
        </CardContent>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5" />
          <div>
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </Card>
    </div>
  );
}
