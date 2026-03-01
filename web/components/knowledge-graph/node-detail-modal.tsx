'use client';

/**
 * Detail modal for inspecting knowledge graph nodes and collection items.
 *
 * @remarks
 * Displays full node details (description, alternate labels, authors, notes,
 * relationships, external IDs) in a dialog. Supports in-modal navigation:
 * clicking a related node pushes the current node onto a stack and displays
 * the target node, with a back button to return.
 *
 * @example
 * ```tsx
 * const [selectedNode, setSelectedNode] = useState<NodeCardData | null>(null);
 * const [open, setOpen] = useState(false);
 *
 * <NodeDetailModal
 *   node={selectedNode}
 *   open={open}
 *   onOpenChange={setOpen}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  ArrowLeft,
  ExternalLink as ExternalLinkIcon,
  StickyNote,
  ChevronRight,
  Link2,
  Loader2,
  Pencil,
  Check,
  X as XIcon,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { NodeExternalIds } from '@/components/knowledge-graph/node-external-ids';
import type { NodeExternalId, NodeIdSource } from '@/components/knowledge-graph/node-external-ids';
import { useNodeEdges, type ResolvedEdge } from '@/lib/hooks/use-node-edges';

import type { NodeCardData, ExternalId } from './types';
import { SUBKIND_BY_SLUG, getStatusColor } from './types';
import type { CollectionItemView, InterItemEdge } from '@/lib/hooks/use-collections';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the NodeDetailModal component.
 */
export interface NodeDetailModalProps {
  /** The node to display, or null when the modal should have no content. */
  node: NodeCardData | null;
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback to change the open state. */
  onOpenChange: (open: boolean) => void;
  /** Inter-item edges from a collection context, if applicable. */
  collectionEdges?: InterItemEdge[];
  /** Collection items for resolving labels of edge endpoints. */
  collectionItems?: CollectionItemView[];
  /** Whether the current user can edit this item (label/note). */
  editable?: boolean;
  /** Callback to save updated label and/or note. */
  onSave?: (updates: { label?: string; note?: string }) => Promise<void>;
  /** Whether a save is in progress. */
  isSaving?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Known external ID source slugs that can be mapped to NodeIdSource.
 */
const KNOWN_SOURCES = new Set<string>(['wikidata', 'lcsh', 'fast', 'mesh', 'aat', 'getty']);

/**
 * Maps an ExternalId (from types.ts) to NodeExternalId (for node-external-ids).
 *
 * @param ext - the ExternalId from the node data
 * @returns a NodeExternalId for rendering, or null if the source is not recognized
 */
function toNodeExternalId(ext: ExternalId): NodeExternalId | null {
  if (!KNOWN_SOURCES.has(ext.system)) {
    return null;
  }
  return {
    source: ext.system as NodeIdSource,
    id: ext.identifier,
    url: ext.uri,
  };
}

/**
 * Returns the directional icon for a relation slug.
 *
 * @param slug - the relation slug (e.g., 'broader', 'narrower', 'related')
 * @returns a Lucide icon component
 */
function getRelationIcon(slug: string): typeof ArrowUpRight {
  if (slug === 'broader') return ArrowUpRight;
  if (slug === 'narrower') return ArrowDownRight;
  return ArrowRight;
}

/**
 * Formats a relation slug as a human-readable heading.
 *
 * @param slug - the relation slug (e.g., 'broader-than', 'related')
 * @returns formatted string with words capitalized and hyphens replaced by spaces
 */
function formatRelationSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Detail modal for knowledge graph nodes and collection items.
 *
 * @remarks
 * Supports in-modal navigation via a stack of previously viewed nodes.
 * Clicking a related node pushes the current node onto the stack and
 * displays the target. The back button pops the stack.
 *
 * @param props - component props
 * @returns React element rendering the detail dialog
 */
export function NodeDetailModal({
  node,
  open,
  onOpenChange,
  collectionEdges,
  collectionItems,
  editable = false,
  onSave,
  isSaving = false,
}: NodeDetailModalProps) {
  const router = useRouter();
  const [navStack, setNavStack] = useState<NodeCardData[]>([]);
  const [navigatedNode, setNavigatedNode] = useState<NodeCardData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [editNote, setEditNote] = useState('');

  // The currently displayed node: navigated node takes priority, then the prop
  const currentNode = navigatedNode ?? node;

  // Fetch edges for the current node (only for AT-URI items, not bare DIDs)
  const canFetchEdges = open && currentNode && currentNode.uri.startsWith('at://');
  const {
    data: edgesData,
    isLoading: edgesLoading,
    error: edgesError,
  } = useNodeEdges(canFetchEdges ? currentNode.uri : null);

  // Clear navigation and edit state when the modal closes
  useEffect(() => {
    if (!open) {
      setNavStack([]);
      setNavigatedNode(null);
      setIsEditing(false);
    }
  }, [open]);

  // Reset navigation when the source node prop changes
  useEffect(() => {
    if (node) {
      setNavStack([]);
      setNavigatedNode(null);
    }
  }, [node?.uri]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Navigate to a related node within the modal.
   */
  const handleNavigateToNode = useCallback(
    (targetUri: string, targetLabel: string) => {
      if (!currentNode) return;

      // Push current node onto the stack
      setNavStack((prev) => [...prev, currentNode]);

      // Create a minimal NodeCardData for the target
      setNavigatedNode({
        uri: targetUri,
        id: targetUri.split('/').pop() ?? '',
        label: targetLabel,
        itemType: 'graphNode',
      });
    },
    [currentNode]
  );

  /**
   * Navigate back to the previous node in the stack.
   */
  const handleBack = useCallback(() => {
    setNavStack((prev) => {
      const newStack = [...prev];
      const previousNode = newStack.pop();
      if (previousNode) {
        // If the previous node is the original prop node, clear navigatedNode
        setNavigatedNode(previousNode.uri === node?.uri ? null : previousNode);
      }
      return newStack;
    });
  }, [node?.uri]);

  /**
   * Handle closing: reset navigation and call onOpenChange.
   */
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setNavStack([]);
        setNavigatedNode(null);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  /**
   * Navigate to the full detail page for the current node.
   */
  const handleViewFullPage = useCallback(() => {
    if (currentNode?.detailPageUrl) {
      router.push(currentNode.detailPageUrl);
      handleOpenChange(false);
    }
  }, [currentNode, router, handleOpenChange]);

  /**
   * Enter edit mode with current values pre-filled.
   */
  const handleStartEdit = useCallback(() => {
    if (!currentNode) return;
    setEditLabel(currentNode.label);
    setEditNote(currentNode.note ?? '');
    setIsEditing(true);
  }, [currentNode]);

  /**
   * Save edits and exit edit mode only after the mutation resolves.
   */
  const handleSaveEdit = useCallback(async () => {
    if (!onSave || !currentNode) return;
    const trimmedLabel = editLabel.trim();
    if (!trimmedLabel) return;
    const updates: { label?: string; note?: string } = {};
    if (trimmedLabel !== currentNode.label) updates.label = trimmedLabel;
    const trimmedNote = editNote.trim();
    if (trimmedNote !== (currentNode.note ?? '')) updates.note = trimmedNote;
    if (Object.keys(updates).length > 0) {
      try {
        await onSave(updates);
      } catch {
        // Stay in edit mode so user can retry
        return;
      }
    }
    setIsEditing(false);
  }, [onSave, currentNode, editLabel, editNote]);

  /**
   * Cancel editing without saving.
   */
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Resolve collection edges relevant to the current node
  const relevantCollectionEdges = useMemo(() => {
    if (!collectionEdges || !currentNode) return [];
    return collectionEdges.filter(
      (edge) => edge.sourceUri === currentNode.uri || edge.targetUri === currentNode.uri
    );
  }, [collectionEdges, currentNode]);

  // Build a label lookup from collection items
  const itemLabelMap = useMemo(() => {
    if (!collectionItems) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const item of collectionItems) {
      map.set(
        item.itemUri,
        item.label ?? item.title ?? item.itemUri.split('/').pop() ?? item.itemUri
      );
    }
    return map;
  }, [collectionItems]);

  // Map external IDs for the NodeExternalIds component
  const mappedExternalIds = useMemo(() => {
    if (!currentNode?.externalIds) return [];
    return currentNode.externalIds
      .map(toNodeExternalId)
      .filter((id): id is NodeExternalId => id !== null);
  }, [currentNode?.externalIds]);

  if (!currentNode) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Node Detail</DialogTitle>
            <DialogDescription>No node selected.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const subkindConfig = currentNode.subkind ? SUBKIND_BY_SLUG.get(currentNode.subkind) : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          {/* Back button */}
          {navStack.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleBack} className="w-fit -ml-2 mb-1">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}

          {/* Title row with avatar and edit */}
          <div className="flex items-center gap-3">
            {currentNode.avatar && (
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={currentNode.avatar} alt={currentNode.label} />
                <AvatarFallback className="text-sm">
                  {currentNode.label
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            {isEditing ? (
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="text-xl font-semibold"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                autoFocus
              />
            ) : (
              <DialogTitle className="text-xl flex-1">{currentNode.label}</DialogTitle>
            )}
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {subkindConfig && (
              <Badge
                variant="secondary"
                className={cn(
                  'text-[10px]',
                  subkindConfig.kind === 'type'
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                )}
              >
                {subkindConfig.singularLabel}
              </Badge>
            )}
            {currentNode.status && (
              <Badge
                variant="secondary"
                className={cn('text-[10px]', getStatusColor(currentNode.status))}
              >
                {currentNode.status}
              </Badge>
            )}
            {currentNode.itemType && currentNode.itemType !== 'graphNode' && !subkindConfig && (
              <Badge variant="outline" className="text-[10px]">
                {currentNode.itemType}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          <div className="space-y-4 pb-4">
            {/* Description */}
            {currentNode.description && (
              <DialogDescription>{currentNode.description}</DialogDescription>
            )}

            {/* Alternate labels */}
            {currentNode.alternateLabels && currentNode.alternateLabels.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Also known as: {currentNode.alternateLabels.join(', ')}
              </p>
            )}

            {/* Authors */}
            {currentNode.authors && currentNode.authors.length > 0 && (
              <p className="text-sm text-muted-foreground">by {currentNode.authors.join(', ')}</p>
            )}

            {/* User note (read-only or editable) */}
            {isEditing ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Note</label>
                <Textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                />
              </div>
            ) : currentNode.note ? (
              <div className="flex items-start gap-1.5 rounded-md bg-muted/50 px-3 py-2">
                <StickyNote className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground italic">{currentNode.note}</p>
              </div>
            ) : null}

            <Separator />

            {/* Unified relationships section */}
            <RelationshipsSection
              edgesData={edgesData}
              edgesLoading={edgesLoading}
              edgesError={edgesError}
              collectionEdges={relevantCollectionEdges}
              currentNodeUri={currentNode.uri}
              itemLabelMap={itemLabelMap}
              onNavigate={handleNavigateToNode}
            />

            {/* External IDs */}
            {mappedExternalIds.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <ExternalLinkIcon className="h-4 w-4" />
                    External Identifiers
                  </h3>
                  <NodeExternalIds externalIds={mappedExternalIds} variant="badges" />
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0">
          {isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                <XIcon className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={!editLabel.trim() || isSaving}>
                <Check className="h-4 w-4 mr-1" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              {editable && navStack.length === 0 && (
                <Button variant="outline" size="sm" onClick={handleStartEdit}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
              {currentNode.detailPageUrl && (
                <Button variant="outline" size="sm" onClick={handleViewFullPage}>
                  <ChevronRight className="h-4 w-4 mr-1" />
                  View full page
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Props for the RelationshipsSection component.
 */
interface RelationshipsSectionProps {
  edgesData: { edges: ResolvedEdge[]; grouped: Record<string, ResolvedEdge[]> } | undefined;
  edgesLoading: boolean;
  edgesError: Error | null;
  collectionEdges: InterItemEdge[];
  currentNodeUri: string;
  itemLabelMap: Map<string, string>;
  onNavigate: (uri: string, label: string) => void;
}

/**
 * Displays grouped relationships from graph edges and collection edges.
 */
function RelationshipsSection({
  edgesData,
  edgesLoading,
  edgesError,
  collectionEdges,
  currentNodeUri,
  itemLabelMap,
  onNavigate,
}: RelationshipsSectionProps) {
  // Merge collection edges into the same grouped structure
  const collectionGrouped = useMemo(() => {
    const groups: Record<string, Array<{ uri: string; label: string }>> = {};
    for (const edge of collectionEdges) {
      if (!groups[edge.relationSlug]) {
        groups[edge.relationSlug] = [];
      }
      const otherUri = edge.sourceUri === currentNodeUri ? edge.targetUri : edge.sourceUri;
      const label = itemLabelMap.get(otherUri) ?? otherUri.split('/').pop() ?? otherUri;
      groups[edge.relationSlug]!.push({ uri: otherUri, label });
    }
    return groups;
  }, [collectionEdges, currentNodeUri, itemLabelMap]);

  const graphEdgeCount = edgesData?.edges.length ?? 0;
  const totalCount = graphEdgeCount + collectionEdges.length;
  const hasAnyEdges = totalCount > 0;
  const allRelationSlugs = useMemo(() => {
    const slugs = new Set<string>();
    if (edgesData?.grouped) {
      for (const slug of Object.keys(edgesData.grouped)) slugs.add(slug);
    }
    for (const slug of Object.keys(collectionGrouped)) slugs.add(slug);
    return [...slugs].sort();
  }, [edgesData?.grouped, collectionGrouped]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Link2 className="h-4 w-4" />
        Relationships
        {!edgesLoading && (
          <Badge variant="secondary" className="text-[10px] ml-1">
            {totalCount}
          </Badge>
        )}
      </h3>

      {edgesLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading relationships...
        </div>
      )}

      {edgesError && !edgesLoading && (
        <p className="text-sm text-muted-foreground py-1">Failed to load relationships</p>
      )}

      {!edgesLoading && !hasAnyEdges && (
        <p className="text-sm text-muted-foreground py-1">No relationships found</p>
      )}

      {hasAnyEdges && (
        <div className="space-y-3">
          {allRelationSlugs.map((slug) => {
            const Icon = getRelationIcon(slug);
            const graphEdges = edgesData?.grouped[slug] ?? [];
            const collectionItems = collectionGrouped[slug] ?? [];

            return (
              <div key={slug} className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  <Icon className="h-3.5 w-3.5" />
                  {formatRelationSlug(slug)}
                </h4>
                <ul className="space-y-0.5">
                  {graphEdges.map((edge) => (
                    <li key={edge.uri}>
                      <button
                        onClick={() => onNavigate(edge.otherUri, edge.otherLabel)}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors w-full text-left"
                      >
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{edge.otherLabel}</span>
                      </button>
                    </li>
                  ))}
                  {collectionItems.map((item) => (
                    <li key={item.uri}>
                      <button
                        onClick={() => onNavigate(item.uri, item.label)}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors w-full text-left"
                      >
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
