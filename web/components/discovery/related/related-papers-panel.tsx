'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/auth';
import { useSimilarPapers, usePrefetchSimilarPapers } from '@/lib/hooks/use-discovery';
import { useEprintRelatedWorks, useDeleteRelatedWork } from '@/lib/hooks/use-related-works';
import { RelationshipBadge } from './relationship-badge';
import { AddRelatedPaperDialog } from './add-related-paper-dialog';
import { createLogger } from '@/lib/observability/logger';
import type { RelatedEprint } from '@/lib/api/schema';

const logger = createLogger({ context: { component: 'related-papers-panel' } });

/**
 * Props for RelatedPapersPanel component.
 */
export interface RelatedPapersPanelProps {
  /** AT-URI of the source eprint */
  eprintUri: string;
  /** Number of auto-discovered related papers to show */
  limit?: number;
  /** Whether the user can add or remove community entries */
  editable?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Unified panel displaying both auto-discovered and user-curated related papers.
 *
 * @remarks
 * Merges suggested (auto-discovered via similarity signals) and community
 * (user-curated) related papers into a single card with labeled sections.
 * When editable, shows an "Add Related Paper" button and delete controls
 * for the current user's entries.
 *
 * @example
 * ```tsx
 * <RelatedPapersPanel
 *   eprintUri="at://did:plc:abc/pub.chive.eprint.submission/123"
 *   limit={5}
 *   editable
 * />
 * ```
 */
export function RelatedPapersPanel({
  eprintUri,
  limit = 5,
  editable = false,
  className,
}: RelatedPapersPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const currentUser = useCurrentUser();

  // Auto-discovered similar papers
  const {
    data: similarData,
    isLoading: similarLoading,
    isError: similarError,
    error: similarErrorObj,
  } = useSimilarPapers(eprintUri, { limit });

  // User-curated related works
  const {
    data: relatedWorksData,
    isLoading: relatedWorksLoading,
    isError: relatedWorksError,
    error: relatedWorksErrorObj,
  } = useEprintRelatedWorks(eprintUri);

  const deleteRelatedWork = useDeleteRelatedWork();

  const isLoading = similarLoading || relatedWorksLoading;
  const isError = similarError && relatedWorksError;

  const suggestedPapers = similarData?.related ?? [];
  const communityWorks = relatedWorksData?.relatedWorks ?? [];
  const bothEmpty = suggestedPapers.length === 0 && communityWorks.length === 0;

  const handleDelete = async (uri: string) => {
    try {
      await deleteRelatedWork.mutateAsync({ uri, eprintUri });
      logger.info('Related work deleted', { uri, eprintUri });
    } catch (err) {
      logger.warn('Failed to delete related work', {
        uri,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  // Show error state only when both sources fail
  if (isError) {
    const errorMessage =
      similarErrorObj instanceof Error
        ? similarErrorObj.message
        : relatedWorksErrorObj instanceof Error
          ? relatedWorksErrorObj.message
          : 'Unknown error';

    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">Failed to load related papers: {errorMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Related Papers
          </CardTitle>
          {editable && (
            <Button variant="outline" size="sm" onClick={handleOpenDialog}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Related Paper
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <RelatedPapersListSkeleton count={3} />
        ) : bothEmpty ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            No related papers found yet.
          </p>
        ) : (
          <div className="space-y-6">
            {/* Auto-discovered section */}
            {suggestedPapers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Suggested
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {suggestedPapers.length}
                  </span>
                </div>
                {suggestedPapers.map((paper) => (
                  <RelatedPaperCard key={paper.uri} paper={paper} />
                ))}
                {suggestedPapers.length >= limit && (
                  <Button variant="ghost" size="sm" className="w-full" asChild>
                    <Link href={`/eprints/${encodeURIComponent(eprintUri)}/related`}>
                      View all related papers
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
            )}

            {/* User-curated section */}
            {communityWorks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Community
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {communityWorks.length}
                  </span>
                </div>
                {communityWorks.map((work) => {
                  const isOwn = currentUser?.did && work.author.did === currentUser.did;

                  return (
                    <div
                      key={work.uri}
                      className="group flex items-start justify-between gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start gap-2">
                          <Link
                            href={`/eprints/${encodeURIComponent(work.relatedUri)}`}
                            className="text-sm font-medium hover:underline line-clamp-2"
                          >
                            {work.relatedTitle ?? work.relatedUri}
                          </Link>
                          <RelationshipBadge type={work.relationType} className="shrink-0" />
                        </div>
                        {work.relatedAuthors && work.relatedAuthors.length > 0 && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {work.relatedAuthors.join(', ')}
                          </p>
                        )}
                        {work.description && (
                          <p className="text-xs text-muted-foreground italic line-clamp-2">
                            {work.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Added by{' '}
                          {work.author.displayName ?? work.author.handle ?? work.author.did}
                        </p>
                      </div>
                      {editable && isOwn && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDelete(work.uri)}
                          disabled={deleteRelatedWork.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          <span className="sr-only">Delete related work</span>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Add Related Paper Dialog */}
      {editable && (
        <AddRelatedPaperDialog
          eprintUri={eprintUri}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </Card>
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
            score={paper.score / 1000}
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
    <Card className={className}>
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent>
        <RelatedPapersListSkeleton count={3} />
      </CardContent>
    </Card>
  );
}
