'use client';

/**
 * Fovea-style autocomplete for node mentions.
 *
 * @remarks
 * Displays search results grouped by subkind with:
 * - `@` trigger → Object nodes (institutions, persons, etc.)
 * - `#` trigger → Type nodes (fields, facets, etc.)
 *
 * Uses a portal for rendering at the cursor position.
 *
 * @example
 * ```tsx
 * <NodeMentionAutocomplete
 *   trigger="@"
 *   query="MIT"
 *   position={{ top: 100, left: 200 }}
 *   onSelect={handleSelect}
 *   onClose={handleClose}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  getSubkindColorClasses,
  getSubkindIcon,
  getSubkindLabel,
} from '@/lib/constants/subkind-colors';
import type { NodeKind, NodeResult, NodeStatus } from '@/components/knowledge-graph/node-search';
import type { MentionTriggerType } from '@/lib/hooks/use-mention-trigger';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for NodeMentionAutocomplete.
 */
export interface NodeMentionAutocompleteProps {
  /** Active trigger character */
  trigger: MentionTriggerType;

  /** Search query (text after trigger) */
  query: string;

  /** Position for the autocomplete dropdown */
  position: { top: number; left: number };

  /** Callback when a node is selected */
  onSelect: (node: NodeResult, trigger: MentionTriggerType) => void;

  /** Callback to close the autocomplete */
  onClose: () => void;

  /** Maximum results to show */
  maxResults?: number;

  /** Z-index for portal */
  zIndex?: number;
}

// =============================================================================
// API
// =============================================================================

async function searchNodes(
  query: string,
  kind: NodeKind | undefined,
  limit: number
): Promise<NodeResult[]> {
  if (query.length < 1) return [];

  const params = new URLSearchParams({
    query,
    limit: String(limit),
  });

  if (kind) {
    params.set('kind', kind);
  }

  // Only show established or provisional nodes
  params.set('status', 'established');

  const response = await fetch(`/xrpc/pub.chive.graph.searchNodes?${params.toString()}`);

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    nodes: Array<{
      uri: string;
      id: string;
      label: string;
      alternateLabels?: string[];
      description?: string;
      kind: string;
      subkind: string;
      status: string;
      externalIds?: Array<{ system: string; identifier: string; uri?: string }>;
    }>;
  };

  return (data.nodes ?? []).map((n) => ({
    uri: n.uri,
    id: n.id,
    label: n.label,
    alternateLabels: n.alternateLabels,
    description: n.description,
    kind: n.kind as NodeKind,
    subkind: n.subkind,
    status: n.status as NodeStatus,
    externalIds: n.externalIds,
  }));
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Fovea-style autocomplete for node mentions.
 */
export function NodeMentionAutocomplete({
  trigger,
  query,
  position,
  onSelect,
  onClose,
  maxResults = 10,
  zIndex = 50,
}: NodeMentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Map trigger to node kind
  const kind: NodeKind | undefined =
    trigger === '@' ? 'object' : trigger === '#' ? 'type' : undefined;

  // Debounce query
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  // Search nodes
  const {
    data: results,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['node-mention-autocomplete', debouncedQuery, kind, maxResults],
    queryFn: () => searchNodes(debouncedQuery, kind, maxResults),
    enabled: debouncedQuery.length >= 1,
    staleTime: 60 * 1000,
  });

  // Group results by subkind
  const groupedResults = useMemo(() => {
    if (!results) return {};
    return results.reduce(
      (acc, node) => {
        const key = node.subkind;
        if (!acc[key]) acc[key] = [];
        acc[key].push(node);
        return acc;
      },
      {} as Record<string, NodeResult[]>
    );
  }, [results]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => results ?? [], [results]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [flatResults]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!flatResults.length) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % flatResults.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            onSelect(flatResults[selectedIndex], trigger);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatResults, selectedIndex, onSelect, onClose, trigger]
  );

  // Attach keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Portal mounting
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  // Calculate position - keep dropdown in viewport
  const dropdownWidth = 320; // w-80 = 20rem = 320px
  const viewportPadding = 16; // 1rem padding from edge
  const maxLeft =
    typeof window !== 'undefined'
      ? Math.max(
          viewportPadding,
          Math.min(position.left, window.innerWidth - dropdownWidth - viewportPadding)
        )
      : position.left;

  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    top: position.top,
    left: maxLeft,
    zIndex,
    maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
  };

  const content = (
    <div
      ref={listRef}
      style={dropdownStyle}
      className="w-80 max-w-[calc(100vw-2rem)] rounded-md border bg-popover shadow-lg"
      data-testid="node-mention-autocomplete"
    >
      <Command className="rounded-md">
        <CommandList>
          {isLoading && (
            <div
              className="flex items-center justify-center py-6"
              role="status"
              aria-label="Loading"
            >
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && <div className="py-6 text-center text-sm text-destructive">Search failed</div>}

          {!isLoading && !error && query.length >= 1 && flatResults.length === 0 && (
            <CommandEmpty>No {trigger === '@' ? 'entities' : 'types'} found</CommandEmpty>
          )}

          {Object.entries(groupedResults).map(([subkind, nodes]) => {
            const Icon = getSubkindIcon(subkind);
            const label = getSubkindLabel(subkind);
            const colorClasses = getSubkindColorClasses(subkind);

            return (
              <CommandGroup
                key={subkind}
                heading={
                  <span className="flex items-center gap-2">
                    <Icon className="h-3 w-3" />
                    <span>{label}</span>
                  </span>
                }
              >
                {nodes.map((node) => {
                  const nodeIndex = flatResults.findIndex((n) => n.uri === node.uri);
                  const isSelected = nodeIndex === selectedIndex;

                  return (
                    <CommandItem
                      key={node.uri}
                      value={`${node.label}-${node.id}`}
                      onSelect={() => onSelect(node, trigger)}
                      className={cn('cursor-pointer', isSelected && 'bg-accent')}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{node.label}</span>
                          <Badge
                            variant="secondary"
                            className={cn('text-[10px] shrink-0', colorClasses)}
                          >
                            {label}
                          </Badge>
                        </div>
                        {node.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {node.description}
                          </p>
                        )}
                        {node.alternateLabels && node.alternateLabels.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Also: {node.alternateLabels.slice(0, 2).join(', ')}
                            {node.alternateLabels.length > 2 && '...'}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
        </CommandList>
      </Command>
    </div>
  );

  return createPortal(content, document.body);
}
