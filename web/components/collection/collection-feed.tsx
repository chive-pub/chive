'use client';

/**
 * Collection activity feed component.
 *
 * @remarks
 * Displays a paginated activity feed for a collection, showing events
 * like new eprints by tracked authors, reviews, endorsements, and more.
 * Events are fetched from the server via the getFeed XRPC endpoint.
 * Each event renders as a full-width card with icon, description,
 * clickable attribution names, and timestamp.
 *
 * @packageDocumentation
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Highlighter,
  Link2,
  Loader2,
  MessageSquare,
  Star,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCollectionFeed, type CollectionFeedEvent } from '@/lib/hooks/use-collections';
import { formatDate } from '@/lib/utils/format-date';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Maps an event type to its display icon.
 */
function getEventIcon(type: string) {
  switch (type) {
    case 'eprint_by_author':
    case 'eprint_in_field':
    case 'eprint_by_institution':
    case 'eprint_at_event':
      return FileText;
    case 'review_on_eprint':
    case 'review_by_author':
      return MessageSquare;
    case 'endorsement_on_eprint':
    case 'endorsement_by_author':
      return Star;
    case 'annotation_on_eprint':
      return Highlighter;
    case 'eprint_referencing_person':
      return Link2;
    default:
      return BookOpen;
  }
}

/**
 * Returns the eprint detail page URL from an event, if available.
 */
function getEprintUrl(event: CollectionFeedEvent): string | null {
  const eprintUri = event.payload.eprintUri as string | undefined;
  if (eprintUri) return `/eprints/${encodeURIComponent(eprintUri)}`;

  if (
    event.type === 'eprint_by_author' ||
    event.type === 'eprint_in_field' ||
    event.type === 'eprint_by_institution' ||
    event.type === 'eprint_at_event'
  ) {
    return `/eprints/${encodeURIComponent(event.eventUri)}`;
  }

  return null;
}

/**
 * Returns the event title (paper title, etc.).
 */
function getEventTitle(event: CollectionFeedEvent): string {
  const p = event.payload;
  const title = (p.eprintTitle ?? p.title ?? '') as string;
  return title.length > 100 ? title.slice(0, 97) + '...' : title;
}

/**
 * Returns the attribution prefix for an event type.
 */
function getAttributionPrefix(type: string): string {
  switch (type) {
    case 'eprint_by_author':
      return 'Written by';
    case 'review_on_eprint':
    case 'endorsement_on_eprint':
    case 'annotation_on_eprint':
      return 'On tracked eprint';
    case 'review_by_author':
    case 'endorsement_by_author':
      return 'By';
    case 'eprint_in_field':
      return 'In';
    case 'eprint_by_institution':
      return 'From';
    case 'eprint_at_event':
      return 'At';
    case 'eprint_referencing_person':
      return 'References';
    default:
      return 'Via';
  }
}

/**
 * Renders an attribution line with clickable names.
 */
function renderAttribution(
  event: CollectionFeedEvent,
  onItemClick?: (uri: string) => void
): ReactNode {
  const items = event.collectionItems;
  if (!items || items.length === 0) return null;

  const prefix = getAttributionPrefix(event.type);
  // "On tracked eprint" doesn't need the item names
  if (
    event.type === 'review_on_eprint' ||
    event.type === 'endorsement_on_eprint' ||
    event.type === 'annotation_on_eprint'
  ) {
    return prefix;
  }

  const nameElements = items.map((item, i) => {
    const nameEl = onItemClick ? (
      <button
        key={item.uri}
        type="button"
        className="font-medium hover:underline"
        onClick={(e) => {
          e.stopPropagation();
          onItemClick(item.uri);
        }}
      >
        {item.label}
      </button>
    ) : (
      <span key={item.uri} className="font-medium">
        {item.label}
      </span>
    );

    if (i === 0) return nameEl;
    if (i === items.length - 1) {
      return (
        <span key={`sep-${item.uri}`}>
          {items.length === 2 ? ' and ' : ', and '}
          {nameEl}
        </span>
      );
    }
    return <span key={`sep-${item.uri}`}>, {nameEl}</span>;
  });

  return (
    <>
      {prefix} {nameElements}
    </>
  );
}

/**
 * Returns a short label for the event type.
 */
function getEventTypeLabel(type: string): string {
  switch (type) {
    case 'eprint_by_author':
    case 'eprint_in_field':
    case 'eprint_by_institution':
    case 'eprint_at_event':
      return 'Paper';
    case 'review_on_eprint':
    case 'review_by_author':
      return 'Review';
    case 'endorsement_on_eprint':
    case 'endorsement_by_author':
      return 'Endorsement';
    case 'annotation_on_eprint':
      return 'Annotation';
    case 'eprint_referencing_person':
      return 'Reference';
    default:
      return 'Activity';
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

interface CollectionFeedProps {
  collectionUri: string;
  /** Called when a collection item name is clicked in the attribution line. */
  onItemClick?: (itemUri: string) => void;
  className?: string;
}

/**
 * Displays the server-aggregated activity feed for a collection.
 *
 * @param props - component props
 * @returns React element rendering the activity feed
 */
export function CollectionFeed({ collectionUri, onItemClick, className }: CollectionFeedProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useCollectionFeed(collectionUri, { enabled: isOpen });

  const events = data?.pages.flatMap((p) => p.events) ?? [];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger className="flex items-center gap-2 text-lg font-semibold hover:text-foreground/80 transition-colors w-full text-left">
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
        Activity
        {events.length > 0 && (
          <Badge variant="secondary" className="text-xs ml-1">
            {events.length}
            {hasNextPage ? '+' : ''}
          </Badge>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        {isLoading ? (
          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading activity...
          </div>
        ) : isError ? (
          <p className="mt-3 text-sm text-muted-foreground">Failed to load activity feed.</p>
        ) : events.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No activity yet for this collection.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {events.map((event) => {
              const Icon = getEventIcon(event.type);
              const title = getEventTitle(event);
              const eprintUrl = getEprintUrl(event);
              const attribution = renderAttribution(event, onItemClick);
              const snippet = (event.payload.snippet as string) ?? undefined;
              const typeLabel = getEventTypeLabel(event.type);

              return (
                <Card key={`${event.eventUri}-${event.type}`} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {typeLabel}
                        </Badge>
                        <time className="text-xs text-muted-foreground">
                          {formatDate(event.eventAt, { includeTime: true, relative: true })}
                        </time>
                      </div>
                      {title && (
                        <p className="text-sm font-medium mt-1 leading-snug">
                          {eprintUrl ? (
                            <Link href={eprintUrl} className="hover:underline">
                              {title}
                            </Link>
                          ) : (
                            title
                          )}
                        </p>
                      )}
                      {snippet && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {snippet}
                        </p>
                      )}
                      {attribution && (
                        <p className="text-xs text-muted-foreground mt-1">{attribution}</p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* Load more button */}
            {hasNextPage && (
              <div className="pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="text-xs w-full"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
