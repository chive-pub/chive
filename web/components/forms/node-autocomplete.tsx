'use client';

/**
 * Flexible node autocomplete component.
 *
 * @remarks
 * Searches governance-controlled nodes in the knowledge graph with flexible
 * filtering by kind and subkind. Optionally merges in the authenticated
 * user's personal nodes and supports inline creation of new personal nodes.
 *
 * @example
 * ```tsx
 * // License selection (object nodes with subkind 'license')
 * <NodeAutocomplete
 *   kind="object"
 *   subkind="license"
 *   label="License"
 *   value={selectedNodeUri}
 *   onSelect={(node) => {
 *     setValue('licenseUri', node.uri);
 *   }}
 * />
 *
 * // With personal nodes and inline creation
 * <NodeAutocomplete
 *   kind="object"
 *   subkind="concept"
 *   label="Concept"
 *   includePersonal
 *   onSelect={(node) => console.log(node)}
 * />
 *
 * // Search all nodes (no filters)
 * <NodeAutocomplete
 *   label="Node"
 *   onSelect={(node) => console.log(node)}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Tags, Search, Loader2, X, ExternalLink, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/lib/hooks/use-eprint-search';
import { useAuth } from '@/lib/auth';
import {
  usePersonalNodes,
  useCreatePersonalNode,
  type PersonalNodeView,
} from '@/lib/hooks/use-personal-graph';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Node kind in the knowledge graph.
 */
export type NodeKind = 'type' | 'object';

/**
 * Node status in the governance lifecycle.
 */
export type NodeStatus = 'proposed' | 'provisional' | 'established' | 'deprecated';

/**
 * External ID linking to external systems.
 */
export interface NodeExternalId {
  /** External system identifier (e.g., 'wikidata', 'lcsh', 'fast', 'ror') */
  system: string;
  /** Identifier within the system */
  identifier: string;
  /** Optional URI for the external resource */
  uri?: string;
}

/**
 * Node suggestion from search results.
 *
 * @remarks
 * This is the flexible return type that includes all standard node properties
 * plus any additional metadata from the API.
 */
export interface NodeSuggestion {
  /** Node identifier (UUID) */
  id: string;
  /** Node AT-URI */
  uri: string;
  /** Display label */
  label: string;
  /** Description */
  description?: string;
  /** Node kind ('type' or 'object') */
  kind: string;
  /** Subkind slug */
  subkind: string;
  /** Governance status */
  status: string;
  /** External identifiers */
  externalIds?: NodeExternalId[];
  /** Alternate labels/synonyms */
  alternateLabels?: string[];
  /** Subkind-specific metadata */
  metadata?: Record<string, unknown>;
  /** Whether this is a personal (user-owned) node */
  isPersonal?: boolean;
  /** Any additional properties from the API */
  [key: string]: unknown;
}

/**
 * Props for NodeAutocomplete component.
 */
export interface NodeAutocompleteProps {
  /** Filter by node kind ('type' or 'object'). If not provided, searches all kinds. */
  kind?: NodeKind;
  /** Filter by subkind slug (e.g., 'field', 'institution', 'license'). If not provided, searches all subkinds. */
  subkind?: string;
  /** Filter by status. Can be a single status or array. Default: 'established' */
  status?: NodeStatus | NodeStatus[];
  /** Current selected node URI or ID */
  value?: string;
  /** Called when a node is selected */
  onSelect: (node: NodeSuggestion) => void;
  /** Called when selection is cleared */
  onClear?: () => void;
  /** Called when "Create new" is clicked. If provided, uses this instead of the inline form. */
  onCreateNew?: (label: string) => void;
  /** Include the user's personal nodes in the dropdown. Default: true */
  includePersonal?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Label for the dropdown group heading */
  label?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Input ID for accessibility */
  id?: string;
  /** Minimum query length to trigger search (default: 0) */
  minQueryLength?: number;
  /** Maximum results to show (default: 20) */
  limit?: number;
}

// =============================================================================
// API SEARCH FUNCTION
// =============================================================================

/**
 * Response shape from the graph API.
 */
interface GraphApiNode {
  id: string;
  uri: string;
  label: string;
  description?: string;
  kind: string;
  subkind: string;
  status: string;
  externalIds?: NodeExternalId[];
  alternateLabels?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Maps a node response to a NodeSuggestion.
 */
function mapNodeToSuggestion(node: GraphApiNode, isPersonal = false): NodeSuggestion {
  return {
    id: node.id,
    uri: node.uri,
    label: node.label,
    description: node.description,
    kind: node.kind,
    subkind: node.subkind,
    status: node.status,
    externalIds: node.externalIds,
    alternateLabels: node.alternateLabels,
    metadata: node.metadata,
    isPersonal,
    // Spread any additional properties
    ...Object.fromEntries(
      Object.entries(node).filter(
        ([key]) =>
          ![
            'id',
            'uri',
            'label',
            'description',
            'kind',
            'subkind',
            'status',
            'externalIds',
            'alternateLabels',
            'metadata',
          ].includes(key)
      )
    ),
  };
}

/**
 * Maps a PersonalNodeView to a NodeSuggestion.
 */
function mapPersonalNodeToSuggestion(node: PersonalNodeView): NodeSuggestion {
  return {
    id: node.uri,
    uri: node.uri,
    label: node.label,
    description: node.description,
    kind: node.kind,
    subkind: node.subkind ?? '',
    status: node.status,
    metadata: node.metadata,
    isPersonal: true,
  };
}

/**
 * Builds query parameters for the API request.
 */
function buildQueryParams(params: {
  query?: string;
  kind?: NodeKind;
  subkind?: string;
  status?: NodeStatus | NodeStatus[];
  limit: number;
}): URLSearchParams {
  const searchParams = new URLSearchParams();

  if (params.query) {
    searchParams.set('query', params.query);
  }
  if (params.kind) {
    searchParams.set('kind', params.kind);
  }
  if (params.subkind) {
    searchParams.set('subkind', params.subkind);
  }
  // Handle status (use first status if array, or default to 'established')
  const statusValue = Array.isArray(params.status) ? params.status[0] : params.status;
  if (statusValue) {
    searchParams.set('status', statusValue);
  } else {
    searchParams.set('status', 'established');
  }
  searchParams.set('limit', String(params.limit));

  return searchParams;
}

/**
 * List all nodes matching the filters using the listNodes endpoint.
 */
async function listNodes(params: {
  kind?: NodeKind;
  subkind?: string;
  status?: NodeStatus | NodeStatus[];
  limit: number;
}): Promise<NodeSuggestion[]> {
  try {
    const queryParams = buildQueryParams(params);
    const url = `/xrpc/pub.chive.graph.listNodes?${queryParams.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.debug('Node list not available yet');
      return [];
    }

    const data = await response.json();
    return (data.nodes ?? []).map((n: GraphApiNode) => mapNodeToSuggestion(n));
  } catch (error) {
    console.debug('Node list failed:', error);
    return [];
  }
}

/**
 * Search nodes using the searchNodes endpoint.
 */
async function searchNodes(params: {
  query: string;
  kind?: NodeKind;
  subkind?: string;
  status?: NodeStatus | NodeStatus[];
  limit: number;
  minQueryLength: number;
}): Promise<NodeSuggestion[]> {
  // If query is empty or too short, list all nodes instead
  if (params.query.length <= params.minQueryLength) {
    return listNodes({
      kind: params.kind,
      subkind: params.subkind,
      status: params.status,
      limit: params.limit,
    });
  }

  try {
    const queryParams = buildQueryParams(params);
    const url = `/xrpc/pub.chive.graph.searchNodes?${queryParams.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.debug('Node search not available yet');
      return [];
    }

    const data = await response.json();
    return (data.nodes ?? []).map((n: GraphApiNode) => mapNodeToSuggestion(n));
  } catch (error) {
    console.debug('Node search failed:', error);
    return [];
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Gets Wikidata ID from external IDs if present.
 */
function getWikidataId(externalIds?: NodeExternalId[]): string | undefined {
  return externalIds?.find((ext) => ext.system === 'wikidata')?.identifier;
}

/**
 * Generates a default label from value when node is not found in results.
 */
function generateFallbackLabel(value: string): string {
  const name = value.split('/').pop() ?? value;
  return name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// =============================================================================
// INLINE CREATE FORM
// =============================================================================

/**
 * Props for the inline personal node creation form.
 */
interface InlineCreateFormProps {
  /** Pre-filled label from the search query */
  initialLabel: string;
  /** Whether creation is in progress */
  isCreating: boolean;
  /** Called to submit the form */
  onSubmit: (label: string, description: string) => void;
  /** Called to cancel the form */
  onCancel: () => void;
}

/**
 * Inline form for creating a personal node within the dropdown.
 */
function InlineCreateForm({ initialLabel, isCreating, onSubmit, onCancel }: InlineCreateFormProps) {
  const [newLabel, setNewLabel] = useState(initialLabel);
  const [newDescription, setNewDescription] = useState('');
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    labelInputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = newLabel.trim();
      if (!trimmed) return;
      onSubmit(trimmed, newDescription.trim());
    },
    [newLabel, newDescription, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-3 border-t">
      <div className="text-xs font-medium text-muted-foreground">Create personal node</div>
      <Input
        ref={labelInputRef}
        value={newLabel}
        onChange={(e) => setNewLabel(e.target.value)}
        placeholder="Label (required)"
        disabled={isCreating}
        className="h-8 text-sm"
        onKeyDown={(e) => e.stopPropagation()}
      />
      <Textarea
        value={newDescription}
        onChange={(e) => setNewDescription(e.target.value)}
        placeholder="Description (optional)"
        disabled={isCreating}
        className="min-h-[60px] text-sm resize-none"
        onKeyDown={(e) => e.stopPropagation()}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isCreating || !newLabel.trim()} className="h-7">
          {isCreating ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Creating...
            </>
          ) : (
            'Create'
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isCreating}
          className="h-7"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Flexible autocomplete input for knowledge graph nodes.
 *
 * @param props - Component props
 * @returns Node autocomplete element
 */
export function NodeAutocomplete({
  kind,
  subkind,
  status = 'established',
  value,
  onSelect,
  onClear,
  onCreateNew,
  includePersonal = true,
  placeholder,
  label = 'Node',
  disabled = false,
  className,
  id,
  minQueryLength = 0,
  limit = 20,
}: NodeAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<NodeSuggestion | null>(null);
  const [showInlineCreate, setShowInlineCreate] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  // Auth state for personal nodes
  const { user, isAuthenticated } = useAuth();
  const shouldFetchPersonal = includePersonal && isAuthenticated && !!user;

  // Fetch personal nodes when authenticated and includePersonal is true
  const { data: personalNodesData } = usePersonalNodes(user?.did ?? '', {
    subkind,
    enabled: shouldFetchPersonal,
  });

  // Create personal node mutation
  const createPersonalNodeMutation = useCreatePersonalNode();

  // Search for global nodes
  const {
    data: apiResults = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['node-search', kind, subkind, status, debouncedQuery, limit],
    queryFn: () =>
      searchNodes({
        query: debouncedQuery,
        kind,
        subkind,
        status,
        limit,
        minQueryLength,
      }),
    enabled: true,
    staleTime: 60 * 1000,
  });

  // Map personal nodes to suggestions, filtered by query
  const personalSuggestions = useMemo(() => {
    if (!shouldFetchPersonal || !personalNodesData?.nodes) return [];

    const mapped = personalNodesData.nodes.map(mapPersonalNodeToSuggestion);

    // Filter by query if provided
    if (query.length >= 1) {
      const lowerQuery = query.toLowerCase();
      return mapped.filter(
        (s) =>
          s.label.toLowerCase().includes(lowerQuery) ||
          (s.description && s.description.toLowerCase().includes(lowerQuery))
      );
    }

    return mapped;
  }, [shouldFetchPersonal, personalNodesData, query]);

  // Filter API results by query for client-side filtering
  const globalSuggestions = useMemo(() => {
    const lowerQuery = query.toLowerCase();

    if (apiResults.length === 0) {
      return [];
    }

    // Filter by query if provided
    if (query.length >= 1) {
      return apiResults.filter(
        (s) =>
          s.label.toLowerCase().includes(lowerQuery) ||
          s.id.toLowerCase().includes(lowerQuery) ||
          s.alternateLabels?.some((alt) => alt.toLowerCase().includes(lowerQuery))
      );
    }

    return apiResults;
  }, [apiResults, query]);

  // Merge personal + global, deduplicating by URI (personal takes priority)
  const suggestions = useMemo(() => {
    const personalUris = new Set(personalSuggestions.map((s) => s.uri));
    const dedupedGlobal = globalSuggestions.filter((s) => !personalUris.has(s.uri));
    return [...personalSuggestions, ...dedupedGlobal];
  }, [personalSuggestions, globalSuggestions]);

  // Update selected value when external value changes
  useEffect(() => {
    if (value) {
      // If selectedValue already matches this value, don't overwrite it
      if (selectedValue && (selectedValue.id === value || selectedValue.uri === value)) {
        return;
      }

      // Check merged suggestions for a match
      const match = suggestions.find((r) => r.uri === value || r.id === value);
      if (match) {
        setSelectedValue(match);
        return;
      }

      // Check API results directly (suggestions may be filtered by query)
      const apiMatch = apiResults.find((r) => r.uri === value || r.id === value);
      if (apiMatch) {
        setSelectedValue(apiMatch);
        return;
      }

      // Check personal nodes directly
      if (personalNodesData?.nodes) {
        const personalMatch = personalNodesData.nodes.find((n) => n.uri === value);
        if (personalMatch) {
          setSelectedValue(mapPersonalNodeToSuggestion(personalMatch));
          return;
        }
      }

      // Fallback: create a display-friendly representation
      setSelectedValue({
        id: value,
        uri: value,
        label: generateFallbackLabel(value),
        kind: kind ?? 'type',
        subkind: subkind ?? 'unknown',
        status: 'established',
      });
    } else {
      setSelectedValue(null);
    }
  }, [value, suggestions, apiResults, personalNodesData, kind, subkind, selectedValue]);

  const handleSelect = useCallback(
    (suggestion: NodeSuggestion) => {
      setSelectedValue(suggestion);
      setQuery('');
      setIsOpen(false);
      setShowInlineCreate(false);
      onSelect(suggestion);
    },
    [onSelect]
  );

  const handleClear = useCallback(() => {
    setSelectedValue(null);
    setQuery('');
    onClear?.();
  }, [onClear]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setShowInlineCreate(false);
    }
  }, []);

  const handleFocus = useCallback(() => {
    setIsOpen(true);
    refetch();
  }, [refetch]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setShowInlineCreate(false);
  }, []);

  const handleCreateNewClick = useCallback(() => {
    if (onCreateNew) {
      onCreateNew(query.trim());
      setQuery('');
      setIsOpen(false);
      return;
    }
    // Show inline form
    setShowInlineCreate(true);
  }, [onCreateNew, query]);

  const handleInlineCreateSubmit = useCallback(
    async (newLabel: string, description: string) => {
      try {
        const result = await createPersonalNodeMutation.mutateAsync({
          kind: kind ?? 'object',
          subkind: subkind ?? 'concept',
          label: newLabel,
          description: description || undefined,
        });

        // Select the newly created node
        const newSuggestion: NodeSuggestion = {
          id: result.uri,
          uri: result.uri,
          label: result.label,
          description: result.description,
          kind: result.kind,
          subkind: result.subkind ?? '',
          status: result.status,
          isPersonal: true,
        };
        handleSelect(newSuggestion);
      } catch {
        // Mutation error is handled by TanStack Query; the form stays open
      }
    },
    [createPersonalNodeMutation, kind, subkind, handleSelect]
  );

  const handleInlineCreateCancel = useCallback(() => {
    setShowInlineCreate(false);
  }, []);

  // Whether the "Create new" action should be shown
  const showCreateAction = isAuthenticated && (!!onCreateNew || includePersonal);

  // Generate default placeholder from label
  const defaultPlaceholder = `Search ${label.toLowerCase()}...`;

  // Show selected value as badge
  if (selectedValue) {
    const wikidataId = getWikidataId(selectedValue.externalIds);

    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Badge variant="secondary" className="gap-1 py-1 pl-2 pr-1">
          <Tags className="h-3 w-3 text-muted-foreground" />
          <span>{selectedValue.label}</span>
          {selectedValue.isPersonal && (
            <span className="ml-1 text-[10px] font-medium text-muted-foreground bg-muted px-1 py-0.5 rounded">
              Personal
            </span>
          )}
          {wikidataId && (
            <a
              href={`https://www.wikidata.org/wiki/${wikidataId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-muted-foreground hover:text-primary"
              onClick={(e) => e.stopPropagation()}
              title="View on Wikidata"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="ml-1 rounded-full p-0.5 hover:bg-muted"
            aria-label={`Remove ${selectedValue.label}`}
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className={cn('relative', className)}>
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            id={id}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder={placeholder ?? defaultPlaceholder}
            disabled={disabled}
            className="pl-9"
            aria-label={`Search ${label}`}
          />
          {isLoading && (
            <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && suggestions.length === 0 && !showInlineCreate && (
              <CommandEmpty className="py-3 text-center text-sm">
                No {label.toLowerCase()} found
              </CommandEmpty>
            )}

            {/* Personal nodes group */}
            {personalSuggestions.length > 0 && (
              <CommandGroup heading="Personal">
                {personalSuggestions.slice(0, limit).map((suggestion) => (
                  <CommandItem
                    key={suggestion.uri}
                    value={suggestion.uri}
                    onSelect={() => handleSelect(suggestion)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Tags className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span>{suggestion.label}</span>
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1 py-0.5 rounded shrink-0">
                            Personal
                          </span>
                        </div>
                        {suggestion.description && (
                          <span className="text-xs text-muted-foreground ml-6 line-clamp-1">
                            {suggestion.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Separator between personal and global groups */}
            {personalSuggestions.length > 0 && globalSuggestions.length > 0 && <CommandSeparator />}

            {/* Global nodes group */}
            {globalSuggestions.length > 0 && (
              <CommandGroup heading={label}>
                {globalSuggestions.slice(0, limit).map((suggestion) => {
                  const wikidataId = getWikidataId(suggestion.externalIds);

                  return (
                    <CommandItem
                      key={suggestion.id}
                      value={suggestion.id}
                      onSelect={() => handleSelect(suggestion)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Tags className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span>{suggestion.label}</span>
                            {wikidataId && (
                              <a
                                href={`https://www.wikidata.org/wiki/${wikidataId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary"
                                onClick={(e) => e.stopPropagation()}
                                title="View on Wikidata"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          {suggestion.description && (
                            <span className="text-xs text-muted-foreground ml-6 line-clamp-1">
                              {suggestion.description}
                            </span>
                          )}
                        </div>
                        {suggestion.status !== 'established' && (
                          <span className="text-xs text-amber-600 shrink-0">
                            {suggestion.status}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {/* "Create new" action at the bottom of the dropdown */}
            {showCreateAction && !showInlineCreate && (
              <>
                <CommandSeparator />
                <div className="p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-muted-foreground hover:text-foreground"
                    onClick={handleCreateNewClick}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {query.trim() ? `Create new: "${query.trim()}"` : 'Create new...'}
                  </Button>
                </div>
              </>
            )}
          </CommandList>

          {/* Inline create form (shown instead of the button when active) */}
          {showInlineCreate && !onCreateNew && (
            <InlineCreateForm
              initialLabel={query.trim()}
              isCreating={createPersonalNodeMutation.isPending}
              onSubmit={handleInlineCreateSubmit}
              onCancel={handleInlineCreateCancel}
            />
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
