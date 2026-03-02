'use client';

/**
 * Collection activity timeline component.
 *
 * @remarks
 * Derives activity events from collection item timestamps and collection
 * creation time. Displays a vertical timeline sorted newest-first with
 * date, action icon, and item label. Wrapped in a Radix Collapsible with
 * an "Activity" header.
 *
 * Only additions can be shown because removals are not tracked in the
 * current data model.
 *
 * @example
 * ```tsx
 * <CollectionActivity
 *   items={items}
 *   collectionCreatedAt={collection.createdAt}
 *   collectionLabel={collection.label}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronRight, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatDate } from '@/lib/utils/format-date';
import type { CollectionItemView } from '@/lib/hooks/use-collections';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the CollectionActivity component.
 */
interface CollectionActivityProps {
  /** Items in the collection with addedAt timestamps. */
  items: CollectionItemView[];
  /** ISO timestamp of the collection's creation. */
  collectionCreatedAt: string;
  /** Display label for the collection (used in the "created" event). */
  collectionLabel: string;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * A single activity event derived from item or collection timestamps.
 */
interface ActivityEvent {
  /** Unique key for React rendering. */
  key: string;
  /** ISO timestamp of the event. */
  timestamp: string;
  /** Type of event. */
  type: 'creation' | 'addition';
  /** Display label for the event subject. */
  label: string;
  /** Item URI (for addition events), or collection identifier (for creation). */
  uri: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Builds a sorted list of activity events from items and collection metadata.
 *
 * @param items - collection items with addedAt timestamps
 * @param collectionCreatedAt - collection creation ISO timestamp
 * @param collectionLabel - collection display label
 * @returns array of events sorted newest-first
 */
function deriveActivityEvents(
  items: CollectionItemView[],
  collectionCreatedAt: string,
  collectionLabel: string
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  // Collection creation event
  events.push({
    key: 'collection-created',
    timestamp: collectionCreatedAt,
    type: 'creation',
    label: collectionLabel,
    uri: 'collection',
  });

  // Item addition events
  for (const item of items) {
    if (item.addedAt) {
      events.push({
        key: `item-added-${item.edgeUri}`,
        timestamp: item.addedAt,
        type: 'addition',
        label: item.label ?? item.title ?? item.itemUri.split('/').pop() ?? item.itemUri,
        uri: item.itemUri,
      });
    }
  }

  // Sort newest-first
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Displays a collapsible activity timeline for a collection.
 *
 * @remarks
 * Events include collection creation and item additions, derived from
 * existing timestamps. Sorted newest-first. Uses a vertical timeline
 * layout with connecting lines and action-specific icons.
 *
 * @param props - component props
 * @returns React element rendering the activity timeline
 */
export function CollectionActivity({
  items,
  collectionCreatedAt,
  collectionLabel,
  className,
}: CollectionActivityProps) {
  const [isOpen, setIsOpen] = useState(false);

  const events = useMemo(
    () => deriveActivityEvents(items, collectionCreatedAt, collectionLabel),
    [items, collectionCreatedAt, collectionLabel]
  );

  if (events.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger className="flex items-center gap-2 text-lg font-semibold hover:text-foreground/80 transition-colors w-full text-left">
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
        Activity
        <Badge variant="secondary" className="text-xs ml-1">
          {events.length}
        </Badge>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-3 space-y-0">
          {events.map((event, index) => {
            const isLast = index === events.length - 1;
            const Icon = event.type === 'creation' ? Calendar : Plus;

            return (
              <div key={event.key} className="flex gap-3">
                {/* Timeline connector */}
                <div className="flex flex-col items-center">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border bg-background">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  {!isLast && <div className="w-px flex-1 bg-border" />}
                </div>

                {/* Event content */}
                <div className="flex-1 pb-4 min-w-0">
                  <p className="text-sm">
                    {event.type === 'creation' ? (
                      <span>
                        Collection <span className="font-medium">{event.label}</span> created
                      </span>
                    ) : (
                      <span>
                        Added <span className="font-medium truncate">{event.label}</span>
                      </span>
                    )}
                  </p>
                  <time className="text-xs text-muted-foreground" dateTime={event.timestamp}>
                    {formatDate(event.timestamp, { includeTime: true, relative: true })}
                  </time>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
