'use client';

/**
 * Collection item card component.
 *
 * @remarks
 * Renders a single collection item with type-specific content based on the
 * item's `itemType` field. Supports eprints (title, authors, abstract snippet),
 * authors (name, affiliation, avatar), graph nodes (label, kind/subkind badge),
 * reviews/endorsements (preview with link), and a generic fallback for unknown
 * types (URI + type badge).
 *
 * Provides optional callbacks for removing an item or editing its note.
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
  Pencil,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CollectionItemView } from '@/lib/hooks/use-collections';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Extended item data passed to the card.
 *
 * @remarks
 * Extends CollectionItemView with optional metadata fields that may be
 * resolved by the parent component or API. The base `CollectionItemView`
 * provides `title` and `authors`; this interface adds fields for author
 * profiles, graph nodes, and abstract snippets.
 */
export interface CollectionItemCardData extends CollectionItemView {
  /** Abstract snippet for eprint items */
  abstractSnippet?: string;
  /** Display name for author items */
  displayName?: string;
  /** Affiliation for author items */
  affiliation?: string;
  /** Avatar URL for author items */
  avatarUrl?: string;
  /** Label for graph node items */
  label?: string;
  /** Kind for graph node items (e.g., 'field', 'concept') */
  kind?: string;
  /** Subkind for graph node items (e.g., 'discipline', 'method') */
  subkind?: string;
  /** Preview text for review/endorsement items */
  previewText?: string;
}

/**
 * Props for the CollectionItemCard component.
 */
interface CollectionItemCardProps {
  /** The item data to render */
  item: CollectionItemCardData;
  /** Callback to remove this item from the collection */
  onRemove?: (item: CollectionItemCardData) => void;
  /** Callback to edit the note on this item */
  onEditNote?: (item: CollectionItemCardData) => void;
  /** Additional CSS class names */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Icon mapping by item type. */
const ITEM_TYPE_ICONS: Record<string, typeof FileText> = {
  eprint: FileText,
  author: UserIcon,
  graphNode: Tag,
  review: MessageSquare,
  endorsement: ThumbsUp,
};

/** Human-readable label mapping by item type. */
const ITEM_TYPE_LABELS: Record<string, string> = {
  eprint: 'Eprint',
  author: 'Author',
  graphNode: 'Graph Node',
  review: 'Review',
  endorsement: 'Endorsement',
  external: 'External',
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Returns the link target for an item based on its type.
 */
function getItemLink(item: CollectionItemCardData): string | null {
  switch (item.itemType) {
    case 'eprint':
      return `/eprints/${encodeURIComponent(item.itemUri)}`;
    case 'author':
      return `/authors/${item.itemUri.split('/')[2] ?? item.itemUri}`;
    case 'graphNode':
      return `/graph/nodes/${encodeURIComponent(item.itemUri)}`;
    case 'review':
    case 'endorsement':
      return null;
    default:
      return null;
  }
}

/**
 * Extracts initials from a display name for avatar fallback.
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === undefined) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first?.charAt(0) ?? ''}${last?.charAt(0) ?? ''}`.toUpperCase();
}

// =============================================================================
// TYPE-SPECIFIC RENDERERS
// =============================================================================

/**
 * Renders eprint-specific content: title, authors, and abstract snippet.
 */
function EprintContent({ item }: { item: CollectionItemCardData }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="font-medium line-clamp-2">{item.title ?? 'Untitled eprint'}</p>
      {item.authors && item.authors.length > 0 && (
        <p className="text-sm text-muted-foreground line-clamp-1">{item.authors.join(', ')}</p>
      )}
      {item.abstractSnippet && (
        <p className="text-sm text-muted-foreground line-clamp-2">{item.abstractSnippet}</p>
      )}
    </div>
  );
}

/**
 * Renders author-specific content: avatar, name, and affiliation.
 */
function AuthorContent({ item }: { item: CollectionItemCardData }) {
  const name = item.displayName ?? item.title ?? item.itemUri.split('/')[2] ?? 'Unknown';

  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="font-medium line-clamp-1">{name}</p>
        {item.affiliation && (
          <p className="text-sm text-muted-foreground line-clamp-1">{item.affiliation}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Renders graph node content: label with kind/subkind badges.
 */
function GraphNodeContent({ item }: { item: CollectionItemCardData }) {
  const nodeLabel = item.label ?? item.title ?? 'Unnamed node';

  return (
    <div className="min-w-0 space-y-1.5">
      <p className="font-medium line-clamp-1">{nodeLabel}</p>
      <div className="flex flex-wrap gap-1.5">
        {item.kind && (
          <Badge variant="secondary" className="text-xs">
            {item.kind}
          </Badge>
        )}
        {item.subkind && (
          <Badge variant="outline" className="text-xs">
            {item.subkind}
          </Badge>
        )}
      </div>
    </div>
  );
}

/**
 * Renders review or endorsement content: preview text.
 */
function ReviewContent({ item }: { item: CollectionItemCardData }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="font-medium line-clamp-1">
        {item.title ?? (item.itemType === 'endorsement' ? 'Endorsement' : 'Review')}
      </p>
      {item.previewText && (
        <p className="text-sm text-muted-foreground italic line-clamp-2">{item.previewText}</p>
      )}
    </div>
  );
}

/**
 * Renders a generic fallback for unknown item types: URI and type badge.
 */
function GenericContent({ item }: { item: CollectionItemCardData }) {
  const isExternal = !item.itemUri.startsWith('at://');

  return (
    <div className="min-w-0 space-y-1">
      {item.title ? (
        <p className="font-medium line-clamp-1">{item.title}</p>
      ) : (
        <p className="font-mono text-sm text-muted-foreground truncate">{item.itemUri}</p>
      )}
      {isExternal && (
        <a
          href={item.itemUri}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          <span className="truncate">{item.itemUri}</span>
        </a>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Renders a single collection item as a card with type-specific content.
 *
 * @remarks
 * Supports five item types with specialized rendering:
 * - **Eprint**: title, authors, abstract snippet
 * - **Author**: avatar with initials, name, affiliation
 * - **Graph node**: label with kind/subkind badges
 * - **Review/Endorsement**: preview text
 * - **Generic fallback**: URI with type badge
 *
 * The card is optionally wrapped in a link to the item's detail page.
 * Provides remove and edit-note action buttons via callbacks.
 *
 * @example
 * ```tsx
 * <CollectionItemCard
 *   item={item}
 *   onRemove={(item) => removeFromCollection(item.edgeUri)}
 *   onEditNote={(item) => openNoteEditor(item)}
 * />
 * ```
 */
export function CollectionItemCard({
  item,
  onRemove,
  onEditNote,
  className,
}: CollectionItemCardProps) {
  const ItemIcon = ITEM_TYPE_ICONS[item.itemType] ?? ExternalLink;
  const typeLabel = ITEM_TYPE_LABELS[item.itemType] ?? item.itemType;
  const link = getItemLink(item);

  const typeSpecificContent = (() => {
    switch (item.itemType) {
      case 'eprint':
        return <EprintContent item={item} />;
      case 'author':
        return <AuthorContent item={item} />;
      case 'graphNode':
        return <GraphNodeContent item={item} />;
      case 'review':
      case 'endorsement':
        return <ReviewContent item={item} />;
      default:
        return <GenericContent item={item} />;
    }
  })();

  const cardBody = (
    <div className="flex items-start gap-3 min-w-0">
      {/* Type icon */}
      <div className="mt-0.5 flex-shrink-0 rounded-md bg-muted p-1.5">
        <ItemIcon className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Main content area */}
      <div className="min-w-0 flex-1 space-y-2">
        {/* Type badge row */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{typeSpecificContent}</div>
          <Badge variant="outline" className="flex-shrink-0 text-xs">
            {typeLabel}
          </Badge>
        </div>

        {/* User note */}
        {item.note && (
          <div className="flex items-start gap-1.5 rounded-md bg-muted/50 px-3 py-2">
            <StickyNote className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground italic line-clamp-2">{item.note}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {(onRemove || onEditNote) && (
        <div className="flex flex-col gap-1 flex-shrink-0">
          {onEditNote && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEditNote(item);
              }}
              title="Edit note"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove(item);
              }}
              title="Remove from collection"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Card className={cn('transition-colors', link && 'hover:bg-muted/50', className)}>
      <CardContent className="p-4">
        {link ? (
          <Link href={link} className="block">
            {cardBody}
          </Link>
        ) : (
          cardBody
        )}
      </CardContent>
    </Card>
  );
}
