'use client';

/**
 * Dialog for linking a text span to an entity (Wikidata or knowledge graph node).
 *
 * @example
 * ```tsx
 * <EntityLinkDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   selectedText="neural networks"
 *   onLink={handleLink}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react';
import { Link2, ExternalLink, Network, Search } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { WikidataSearch, type WikidataEntity } from './wikidata-search';
import { NodeSearch, type NodeResult } from '@/components/knowledge-graph';
import type { EntityLinkType } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for EntityLinkDialog.
 */
export interface EntityLinkDialogProps {
  /** Dialog open state */
  open: boolean;

  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;

  /** The selected text to link */
  selectedText: string;

  /** Callback when entity is linked */
  onLink: (entity: EntityLinkType) => void;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Dialog for linking text spans to entities.
 *
 * @param props - Component props
 * @returns Dialog element
 */
export function EntityLinkDialog({
  open,
  onOpenChange,
  selectedText,
  onLink,
  className,
}: EntityLinkDialogProps) {
  const [query, setQuery] = useState(selectedText);
  const [selectedEntity, setSelectedEntity] = useState<WikidataEntity | NodeResult | null>(null);
  const [activeTab, setActiveTab] = useState<'wikidata' | 'graph'>('wikidata');

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        setQuery(selectedText);
        setSelectedEntity(null);
      }
      onOpenChange(newOpen);
    },
    [selectedText, onOpenChange]
  );

  const handleWikidataSelect = useCallback((entity: WikidataEntity) => {
    setSelectedEntity(entity);
  }, []);

  const handleNodeSelect = useCallback((node: NodeResult) => {
    setSelectedEntity(node);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedEntity) return;

    // Convert to EntityLinkType
    if ('qid' in selectedEntity) {
      // Wikidata entity
      onLink({
        type: 'wikidata',
        qid: selectedEntity.qid,
        label: selectedEntity.label,
        url: selectedEntity.url,
      });
    } else {
      // Knowledge graph node
      onLink({
        type: 'nodeRef',
        uri: selectedEntity.uri,
        label: selectedEntity.label,
        subkind: selectedEntity.subkind,
      });
    }

    onOpenChange(false);
  }, [selectedEntity, onLink, onOpenChange]);

  const isWikidataEntity = selectedEntity && 'qid' in selectedEntity;
  const isGraphNode = selectedEntity && 'subkind' in selectedEntity;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn('sm:max-w-lg overflow-hidden', className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link to entity
          </DialogTitle>
          <DialogDescription>
            Link &quot;{selectedText}&quot; to a knowledge graph entity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 w-full min-w-0 px-0.5">
          {/* Search input */}
          <div className="space-y-2">
            <Label htmlFor="entity-search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="entity-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search entities..."
                className="pl-9"
              />
            </div>
          </div>

          {/* Tabs for Wikidata vs Knowledge Graph */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'wikidata' | 'graph')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="wikidata" className="gap-1">
                <ExternalLink className="h-3 w-3" />
                Wikidata
              </TabsTrigger>
              <TabsTrigger value="graph" className="gap-1">
                <Network className="h-3 w-3" />
                Knowledge Graph
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="wikidata"
              className="mt-4 max-h-[250px] w-full overflow-y-auto overflow-x-hidden border rounded-md"
            >
              <div className="w-full overflow-hidden">
                <WikidataSearch query={query} onSelect={handleWikidataSelect} />
              </div>
            </TabsContent>

            <TabsContent
              value="graph"
              className="mt-4 max-h-[250px] w-full overflow-y-auto overflow-x-hidden border rounded-md"
            >
              <div className="w-full overflow-hidden [&_.flex-wrap]:flex-nowrap [&_span.truncate]:flex-1 [&_span.truncate]:min-w-0">
                <NodeSearch
                  query={query}
                  onSelect={handleNodeSelect}
                  showSubkind
                  emptyMessage="No nodes found. Try a different search term."
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Selection preview */}
          {selectedEntity && (
            <div className="rounded-md border bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Selected:</p>
              <div className="flex items-center gap-2">
                {isWikidataEntity && (
                  <>
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {selectedEntity.qid}
                    </Badge>
                    <span className="font-medium">{selectedEntity.label}</span>
                  </>
                )}
                {isGraphNode && (
                  <>
                    <Badge
                      variant="secondary"
                      className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                    >
                      {selectedEntity.subkind}
                    </Badge>
                    <span className="font-medium">{selectedEntity.label}</span>
                  </>
                )}
              </div>
              {isWikidataEntity && selectedEntity.description && (
                <p className="text-xs text-muted-foreground mt-1">{selectedEntity.description}</p>
              )}
              {isGraphNode && selectedEntity.description && (
                <p className="text-xs text-muted-foreground mt-1">{selectedEntity.description}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedEntity}
            className="gap-2"
          >
            <Link2 className="h-4 w-4" />
            Link entity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
