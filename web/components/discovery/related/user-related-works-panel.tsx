'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, Plus, Trash2, Link2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/auth';
import { useEprintRelatedWorks, useDeleteRelatedWork } from '@/lib/hooks/use-related-works';
import { useSimilarPapers } from '@/lib/hooks/use-discovery';
import { RelationshipBadge } from './relationship-badge';
import { AddRelatedPaperDialog } from './add-related-paper-dialog';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ context: { component: 'user-related-works-panel' } });

/**
 * Props for UserRelatedWorksPanel component.
 */
export interface UserRelatedWorksPanelProps {
  /** AT-URI of the source eprint */
  eprintUri: string;
  /** Whether the user can add or remove entries */
  editable?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Panel showing user-curated related papers.
 *
 * @remarks
 * Displays user-linked related works with relationship badges.
 * When the list is empty and auto-discovered similar papers exist,
 * shows suggestions with quick "Link" buttons.
 *
 * @example
 * ```tsx
 * <UserRelatedWorksPanel
 *   eprintUri="at://did:plc:abc/pub.chive.eprint.submission/123"
 *   editable
 * />
 * ```
 */
export function UserRelatedWorksPanel({
  eprintUri,
  editable = false,
  className,
}: UserRelatedWorksPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefillUri, setPrefillUri] = useState<string | undefined>(undefined);
  const currentUser = useCurrentUser();

  const { data: relatedWorksData, isLoading, isError, error } = useEprintRelatedWorks(eprintUri);

  const deleteRelatedWork = useDeleteRelatedWork();

  // Fetch similar papers for suggestions when user-curated list is empty
  const { data: similarData } = useSimilarPapers(eprintUri, {
    limit: 3,
    enabled: !isLoading && (!relatedWorksData || relatedWorksData.relatedWorks.length === 0),
  });

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

  const handleSuggestionLink = (suggestedUri: string) => {
    setPrefillUri(suggestedUri);
    setDialogOpen(true);
  };

  const handleOpenDialog = () => {
    setPrefillUri(undefined);
    setDialogOpen(true);
  };

  if (isError) {
    logger.warn('Failed to load user-curated related works', {
      eprintUri,
      error: error instanceof Error ? error.message : String(error),
    });
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">
            Failed to load related works: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const relatedWorks = relatedWorksData?.relatedWorks ?? [];
  const isEmpty = relatedWorks.length === 0;
  const hasSuggestions =
    isEmpty && similarData && similarData.related && similarData.related.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            User-Curated Related Papers
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
          <UserRelatedWorksSkeleton />
        ) : isEmpty ? (
          <div className="space-y-4">
            <p className="text-center text-sm text-muted-foreground py-2">
              No user-curated related papers yet.
            </p>

            {/* Suggestions section */}
            {hasSuggestions && editable && (
              <Card className="border-dashed">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    Suggested Related Papers
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {similarData.related.slice(0, 3).map((paper) => (
                      <div
                        key={paper.uri}
                        className="flex items-start justify-between gap-2 rounded-md border p-2"
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-start gap-2">
                            <Link
                              href={`/eprints/${encodeURIComponent(paper.uri)}`}
                              className="text-sm font-medium hover:underline line-clamp-1"
                            >
                              {paper.title}
                            </Link>
                            <RelationshipBadge
                              type={paper.relationshipType}
                              score={paper.score}
                              className="shrink-0"
                            />
                          </div>
                          {paper.authors && paper.authors.length > 0 && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {paper.authors.map((a) => a.name).join(', ')}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => handleSuggestionLink(paper.uri)}
                        >
                          <Link2 className="mr-1 h-3 w-3" />
                          Link
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {relatedWorks.map((work) => {
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
                      Added by {work.author.displayName ?? work.author.handle ?? work.author.did}
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
      </CardContent>

      {/* Add Related Paper Dialog */}
      {editable && (
        <AddRelatedPaperDialog
          eprintUri={eprintUri}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setPrefillUri(undefined);
          }}
          prefillRelatedUri={prefillUri}
        />
      )}
    </Card>
  );
}

/**
 * Loading skeleton for user-curated related works.
 */
function UserRelatedWorksSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
