'use client';

/**
 * Collection item list component.
 *
 * @remarks
 * Renders the list of items in a collection with type-specific rendering.
 * Supports eprints, authors, graph nodes, reviews, endorsements, and external items.
 * Each item displays its resolved metadata, optional user note, ordering, and
 * a remove button when in edit mode.
 */

import Link from 'next/link';
import {
  FileText,
  User as UserIcon,
  Tag,
  MessageSquare,
  ThumbsUp,
  ExternalLink,
  X,
  StickyNote,
  GripVertical,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CollectionItemView } from '@/lib/hooks/use-collections';

/**
 * Props for the CollectionItemList component.
 */
interface CollectionItemListProps {
  items: CollectionItemView[];
  editable?: boolean;
  onRemove?: (item: CollectionItemView) => void;
  isRemoving?: boolean;
  className?: string;
}

/**
 * Icon mapping by item type.
 */
const ITEM_TYPE_ICONS: Record<string, typeof FileText> = {
  eprint: FileText,
  author: UserIcon,
  graphNode: Tag,
  review: MessageSquare,
  endorsement: ThumbsUp,
};

/**
 * Human-readable label mapping by item type.
 */
const ITEM_TYPE_LABELS: Record<string, string> = {
  eprint: 'Eprint',
  author: 'Author',
  graphNode: 'Graph Node',
  review: 'Review',
  endorsement: 'Endorsement',
  external: 'External',
};

/**
 * Returns the link target for an item based on its type.
 */
function getItemLink(item: CollectionItemView): string | null {
  switch (item.itemType) {
    case 'eprint':
      return `/eprints/${encodeURIComponent(item.itemUri)}`;
    case 'author':
      return `/authors/${item.itemUri.split('/')[2] ?? item.itemUri}`;
    case 'graphNode':
      return null;
    case 'review':
    case 'endorsement':
      return null;
    default:
      return null;
  }
}

/**
 * Renders a single item based on its type.
 */
function CollectionItemContent({ item }: { item: CollectionItemView }) {
  const ItemIcon = ITEM_TYPE_ICONS[item.itemType] ?? ExternalLink;
  const typeLabel = ITEM_TYPE_LABELS[item.itemType] ?? 'Unknown';
  const link = getItemLink(item);

  const content = (
    <div className="flex items-start gap-3 min-w-0">
      <div className="mt-0.5 flex-shrink-0 rounded-md bg-muted p-1.5">
        <ItemIcon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          {item.title ? (
            <span className="font-medium line-clamp-1">{item.title}</span>
          ) : (
            <span className="font-mono text-sm text-muted-foreground truncate block min-w-0">
              {item.itemUri}
            </span>
          )}
          <Badge variant="outline" className="flex-shrink-0 text-xs">
            {typeLabel}
          </Badge>
        </div>

        {item.authors && item.authors.length > 0 && (
          <p className="text-sm text-muted-foreground line-clamp-1">{item.authors.join(', ')}</p>
        )}

        {item.itemType === 'external' || item.itemType === 'unknown' ? (
          <a
            href={item.itemUri.startsWith('at://') ? undefined : item.itemUri}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{item.itemUri}</span>
          </a>
        ) : null}
      </div>
    </div>
  );

  if (link) {
    return (
      <Link href={link} className="block hover:bg-muted/50 transition-colors rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}

/**
 * Renders the ordered list of items in a collection.
 *
 * Each item is rendered with type-specific UI (title, authors for eprints;
 * name and avatar for authors; label/badge for graph nodes; etc.).
 * Items show their optional user note and an order number.
 * In edit mode, each item has a remove button.
 */
export function CollectionItemList({
  items,
  editable = false,
  onRemove,
  isRemoving = false,
  className,
}: CollectionItemListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed p-8 text-center">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">This collection has no items yet.</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item, index) => (
        <Card key={item.edgeUri} className="relative">
          <CardContent className="flex items-start gap-3 p-4">
            {/* Order number */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
              {editable && (
                <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
              )}
              <span className="text-xs font-mono text-muted-foreground tabular-nums w-6 text-center">
                {item.order ?? index + 1}
              </span>
            </div>

            {/* Item content */}
            <div className="min-w-0 flex-1 space-y-2">
              <CollectionItemContent item={item} />

              {/* User note */}
              {item.note && (
                <div className="flex items-start gap-1.5 rounded-md bg-muted/50 px-3 py-2">
                  <StickyNote className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground italic">{item.note}</p>
                </div>
              )}
            </div>

            {/* Remove button */}
            {editable && onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(item)}
                disabled={isRemoving}
                title="Remove from collection"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
