'use client';

/**
 * Collection edge display component.
 *
 * @remarks
 * Displays custom relationships between items in a collection. These are
 * edges beyond the standard CONTAINS relationship that express semantic
 * connections (e.g., "cites", "extends", "inspired-by") between items.
 */

import { ArrowRight, Link2, StickyNote } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CollectionItemView } from '@/lib/hooks/use-collections';

/**
 * Represents a custom edge between two items in a collection.
 */
export interface CollectionEdge {
  sourceUri: string;
  targetUri: string;
  relationSlug: string;
  note?: string;
}

/**
 * Props for the CollectionEdgeDisplay component.
 */
interface CollectionEdgeDisplayProps {
  edges: CollectionEdge[];
  items: CollectionItemView[];
  className?: string;
}

/**
 * Formats a relation slug into a human-readable label.
 *
 * @param slug - The relation slug (e.g., "cites", "extends", "inspired-by")
 * @returns A human-readable label
 */
function formatRelationLabel(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolves an item URI to a display label from the items list.
 */
function resolveItemLabel(uri: string, items: CollectionItemView[]): string {
  const item = items.find((i) => i.itemUri === uri);
  return item?.title ?? uri.split('/').pop() ?? uri;
}

/**
 * Renders custom edges between collection items.
 *
 * If the collection has inter-item relationships beyond CONTAINS (e.g., "cites",
 * "extends", "builds-on"), this component displays them as annotated relationships
 * with optional notes.
 *
 * Returns null if there are no edges to display.
 */
export function CollectionEdgeDisplay({ edges, items, className }: CollectionEdgeDisplayProps) {
  if (edges.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h2 className="text-lg font-semibold mb-3">Relationships</h2>
      <div className="space-y-2">
        {edges.map((edge, index) => {
          const sourceLabel = resolveItemLabel(edge.sourceUri, items);
          const targetLabel = resolveItemLabel(edge.targetUri, items);
          const relationLabel = formatRelationLabel(edge.relationSlug);

          return (
            <Card key={`${edge.sourceUri}-${edge.targetUri}-${index}`}>
              <CardContent className="flex items-center gap-3 p-3">
                <Link2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="font-medium truncate max-w-[200px]" title={sourceLabel}>
                      {sourceLabel}
                    </span>
                    <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {relationLabel}
                    </Badge>
                    <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    <span className="font-medium truncate max-w-[200px]" title={targetLabel}>
                      {targetLabel}
                    </span>
                  </div>

                  {edge.note && (
                    <div className="mt-1.5 flex items-start gap-1.5">
                      <StickyNote className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground italic">{edge.note}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
