'use client';

import { useState } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Database,
  User,
  Bot,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/auth';
import { useEprintCitations, useDeleteCitation } from '@/lib/hooks/use-citations';
import type { CitationView, CitationAuthor } from '@/lib/hooks/use-citations';
import { AddCitationDialog } from './add-citation-dialog';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ context: { component: 'citation-list-panel' } });

/**
 * Props for CitationListPanel component.
 */
export interface CitationListPanelProps {
  /** AT-URI of the eprint */
  eprintUri: string;
  /** Whether the user can add or remove citations */
  editable?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Display configuration for citation sources.
 */
const SOURCE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  user: {
    label: 'User',
    icon: User,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  auto: {
    label: 'Auto',
    icon: Bot,
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  },
  s2: {
    label: 'S2',
    icon: Database,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  crossref: {
    label: 'Crossref',
    icon: Database,
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  grobid: {
    label: 'GROBID',
    icon: Bot,
    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  },
};

/**
 * Default configuration for unknown sources.
 */
const DEFAULT_SOURCE_CONFIG = {
  label: 'Unknown',
  icon: Database,
  color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

/**
 * Panel showing citations for an eprint (both auto-extracted and user-provided).
 *
 * @remarks
 * Displays auto-extracted citations in a muted style and user-provided
 * citations in standard style. Users can add new citations and delete
 * their own entries.
 *
 * @example
 * ```tsx
 * <CitationListPanel
 *   eprintUri="at://did:plc:abc/pub.chive.eprint.submission/123"
 *   editable
 * />
 * ```
 */
export function CitationListPanel({
  eprintUri,
  editable = false,
  className,
}: CitationListPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const currentUser = useCurrentUser();

  const { data, isLoading, isError, error } = useEprintCitations(eprintUri);
  const deleteCitation = useDeleteCitation();

  const handleDelete = async (uri: string) => {
    try {
      await deleteCitation.mutateAsync({ uri, eprintUri });
      logger.info('Citation deleted', { uri, eprintUri });
    } catch (err) {
      logger.warn('Failed to delete citation', {
        uri,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (isError) {
    logger.warn('Failed to load citations', {
      eprintUri,
      error: error instanceof Error ? error.message : String(error),
    });
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">
            Failed to load citations: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const citations = data?.citations ?? [];
  const userCitations = citations.filter((c) => c.source === 'user');
  const autoCitations = citations.filter((c) => c.source !== 'user');

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            Citations
            {data?.total !== undefined && (
              <Badge variant="secondary" className="ml-1">
                {data.total}
              </Badge>
            )}
          </CardTitle>
          {editable && (
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Citation
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <CitationListSkeleton />
        ) : citations.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">No citations found yet.</p>
        ) : (
          <div className="space-y-4">
            {/* User-provided citations */}
            {userCitations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  User-provided ({userCitations.length})
                </p>
                {userCitations.map((citation, i) => (
                  <CitationCard
                    key={citation.uri ?? `user-${i}`}
                    citation={citation}
                    isOwn={!!currentUser?.did && !!citation.uri}
                    editable={editable}
                    onDelete={handleDelete}
                    isDeleting={deleteCitation.isPending}
                  />
                ))}
              </div>
            )}

            {/* Auto-extracted citations */}
            {autoCitations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Auto-extracted ({autoCitations.length})
                </p>
                {autoCitations.map((citation, i) => (
                  <CitationCard
                    key={citation.uri ?? `auto-${i}`}
                    citation={citation}
                    isOwn={false}
                    editable={false}
                    onDelete={handleDelete}
                    isDeleting={false}
                    muted
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Add Citation Dialog */}
      {editable && (
        <AddCitationDialog eprintUri={eprintUri} open={dialogOpen} onOpenChange={setDialogOpen} />
      )}
    </Card>
  );
}

/**
 * Props for CitationCard component.
 */
interface CitationCardProps {
  citation: CitationView;
  isOwn: boolean;
  editable: boolean;
  onDelete: (uri: string) => void;
  isDeleting: boolean;
  muted?: boolean;
}

/**
 * Individual citation card with source badge and expandable context.
 */
function CitationCard({
  citation,
  isOwn,
  editable,
  onDelete,
  isDeleting,
  muted = false,
}: CitationCardProps) {
  const [contextExpanded, setContextExpanded] = useState(false);
  const sourceConfig = SOURCE_CONFIG[citation.source] ?? DEFAULT_SOURCE_CONFIG;
  const SourceIcon = sourceConfig.icon;

  const authorNames = citation.authors
    ?.map((a: CitationAuthor) => [a.firstName, a.lastName].filter(Boolean).join(' '))
    .filter(Boolean);

  return (
    <div
      className={cn(
        'group rounded-lg border p-3 transition-colors',
        muted ? 'border-muted bg-muted/30' : 'hover:bg-muted/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          {/* Title and source badge */}
          <div className="flex items-start gap-2">
            {citation.doi || citation.chiveUri ? (
              <a
                href={
                  citation.chiveUri
                    ? `/eprints/${encodeURIComponent(citation.chiveUri)}`
                    : `https://doi.org/${citation.doi}`
                }
                target={citation.chiveUri ? undefined : '_blank'}
                rel={citation.chiveUri ? undefined : 'noopener noreferrer'}
                className="text-sm font-medium hover:underline line-clamp-2"
              >
                {citation.title}
                {!citation.chiveUri && (
                  <ExternalLink className="inline ml-1 h-3 w-3 text-muted-foreground" />
                )}
              </a>
            ) : (
              <span className="text-sm font-medium line-clamp-2">{citation.title}</span>
            )}
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                sourceConfig.color
              )}
            >
              <SourceIcon className="h-3 w-3" />
              {sourceConfig.label}
            </span>
          </div>

          {/* Authors */}
          {authorNames && authorNames.length > 0 && (
            <p className="text-xs text-muted-foreground line-clamp-1">{authorNames.join(', ')}</p>
          )}

          {/* Year, venue, DOI */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {citation.year && <span>{citation.year}</span>}
            {citation.venue && (
              <>
                {citation.year && <span>&middot;</span>}
                <span className="truncate">{citation.venue}</span>
              </>
            )}
            {citation.doi && (
              <>
                {(citation.year || citation.venue) && <span>&middot;</span>}
                <a
                  href={`https://doi.org/${citation.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  DOI: {citation.doi}
                </a>
              </>
            )}
            {citation.citationType && (
              <>
                <span>&middot;</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {citation.citationType}
                </Badge>
              </>
            )}
          </div>

          {/* Expandable context */}
          {citation.context && (
            <Collapsible open={contextExpanded} onOpenChange={setContextExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1 text-xs text-muted-foreground"
                >
                  {contextExpanded ? (
                    <>
                      <ChevronUp className="mr-1 h-3 w-3" />
                      Hide context
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 h-3 w-3" />
                      Show context
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-xs text-muted-foreground italic mt-1 pl-1 border-l-2 border-muted-foreground/20">
                  {citation.context}
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {/* Delete button */}
        {editable && isOwn && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onDelete(citation.uri!)}
            disabled={isDeleting}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
            <span className="sr-only">Delete citation</span>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for citation list.
 */
function CitationListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-14" />
          </div>
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
