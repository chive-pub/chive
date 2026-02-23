'use client';

/**
 * Unified node card component for knowledge graph and collection items.
 *
 * @remarks
 * Renders a single item (graph node, eprint, author, review, etc.) as a card
 * or compact button. Supports an actions slot, note display, author list, and
 * status badges. Used by both the knowledge graph viewer and collection views.
 *
 * @example
 * ```tsx
 * <NodeCard
 *   node={graphNodeToCardData(node)}
 *   onClick={() => handleSelect(node)}
 *   showSubkind
 * />
 *
 * <NodeCard
 *   node={collectionItemToCardData(item)}
 *   compact
 *   actions={<RemoveButton />}
 * />
 * ```
 *
 * @packageDocumentation
 */

import type { ReactNode } from 'react';
import {
  Network,
  ExternalLink,
  StickyNote,
  FileText,
  User as UserIcon,
  MessageSquare,
  ThumbsUp,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { NodeCardData } from './types';
import { SUBKIND_BY_SLUG, getStatusColor } from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the NodeCard component.
 */
export interface NodeCardProps {
  /** The unified node data to render. */
  node: NodeCardData;
  /** Click handler for the entire card. */
  onClick?: () => void;
  /** Whether to show the subkind label badge. */
  showSubkind?: boolean;
  /** Compact single-line rendering. */
  compact?: boolean;
  /** Actions slot rendered in the header (before status badge). */
  actions?: ReactNode;
  /** Additional CSS classes. */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Icon mapping by item type for non-graphNode items. */
const ITEM_TYPE_ICONS: Record<string, typeof FileText> = {
  eprint: FileText,
  author: UserIcon,
  review: MessageSquare,
  endorsement: ThumbsUp,
};

/** Human-readable labels for item types. */
const ITEM_TYPE_LABELS: Record<string, string> = {
  eprint: 'Eprint',
  author: 'Author',
  review: 'Review',
  endorsement: 'Endorsement',
  graphNode: 'Graph Node',
};

/**
 * Resolves the display icon for a node card.
 *
 * For graph nodes (or items with a known subkind), uses the subkind
 * configuration icon. For other item types, uses a type-specific icon.
 * Falls back to the Network icon.
 */
function resolveIcon(node: NodeCardData): typeof Network {
  if (node.subkind) {
    const config = SUBKIND_BY_SLUG.get(node.subkind);
    if (config) return config.icon;
  }

  if (node.itemType && node.itemType !== 'graphNode') {
    const typeIcon = ITEM_TYPE_ICONS[node.itemType];
    if (typeIcon) return typeIcon;
  }

  return Network;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Unified card for rendering knowledge graph nodes and collection items.
 *
 * @remarks
 * In full mode, renders a Card with icon, label, badges, description,
 * alternate labels, external IDs, author list, and user note.
 * In compact mode, renders a single-line button with icon, label, and badges.
 * The actions slot appears in the header alongside the status badge.
 */
export function NodeCard({
  node,
  onClick,
  showSubkind = false,
  compact = false,
  actions,
  className,
}: NodeCardProps) {
  const Icon = resolveIcon(node);
  const subkindConfig = node.subkind ? SUBKIND_BY_SLUG.get(node.subkind) : undefined;

  // ---------------------------------------------------------------------------
  // Compact mode
  // ---------------------------------------------------------------------------

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'flex items-center gap-2 rounded-lg border p-2 text-left transition-colors hover:bg-muted/50 w-full',
          className
        )}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-medium text-sm">{node.label}</span>

        {/* Actions slot */}
        {actions && (
          <span
            className="flex items-center"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {actions}
          </span>
        )}

        {/* Item type badge (for non-graphNode items without a subkind) */}
        {node.itemType && node.itemType !== 'graphNode' && !node.subkind && (
          <Badge variant="outline" className="text-[10px]">
            {ITEM_TYPE_LABELS[node.itemType] ?? node.itemType}
          </Badge>
        )}

        {/* Status badge */}
        {node.status && (
          <Badge variant="secondary" className={cn('text-[10px]', getStatusColor(node.status))}>
            {node.status}
          </Badge>
        )}
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Full mode
  // ---------------------------------------------------------------------------

  return (
    <Card
      className={cn(
        'transition-colors cursor-pointer hover:border-primary/50',
        onClick && 'hover:shadow-sm',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        {/* Title row: avatar/icon + title + actions only */}
        <div className="flex items-start gap-2">
          {node.avatar ? (
            <Avatar className="h-6 w-6 mt-0.5 shrink-0">
              <AvatarImage src={node.avatar} alt={node.label} />
              <AvatarFallback className="text-[10px]">
                {node.label
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Icon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
          )}
          <CardTitle className="text-base flex-1 min-w-0">{node.label}</CardTitle>
          {actions && (
            <span
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              {actions}
            </span>
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {showSubkind && subkindConfig && (
            <Badge variant="outline" className="text-[10px]">
              {subkindConfig.label}
            </Badge>
          )}
          {node.itemType && node.itemType !== 'graphNode' && !node.subkind && (
            <Badge variant="outline" className="text-[10px]">
              {ITEM_TYPE_LABELS[node.itemType] ?? node.itemType}
            </Badge>
          )}
          {node.status && (
            <Badge variant="secondary" className={cn('text-[10px]', getStatusColor(node.status))}>
              {node.status}
            </Badge>
          )}
          {node.source === 'community' && (
            <Badge
              variant="secondary"
              className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            >
              Community
            </Badge>
          )}
          {node.source === 'personal' && (
            <Badge
              variant="secondary"
              className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            >
              Personal
            </Badge>
          )}
        </div>

        {/* Description */}
        {node.description && (
          <CardDescription className="line-clamp-2">{node.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2">
          {/* Alternate labels and external IDs row */}
          <div className="flex flex-wrap items-center gap-2">
            {node.alternateLabels && node.alternateLabels.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Also: {node.alternateLabels.slice(0, 3).join(', ')}
                {node.alternateLabels.length > 3 && '...'}
              </span>
            )}
            {node.externalIds && node.externalIds.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ExternalLink className="h-3 w-3" />
                <span>
                  {node.externalIds.length} external ID{node.externalIds.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Authors */}
          {node.authors && node.authors.length > 0 && (
            <p className="text-sm text-muted-foreground">by {node.authors.join(', ')}</p>
          )}

          {/* User note */}
          {node.note && (
            <div className="flex items-start gap-1.5 rounded-md bg-muted/50 px-3 py-2">
              <StickyNote className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground italic line-clamp-2">{node.note}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
