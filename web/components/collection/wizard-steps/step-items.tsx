'use client';

/**
 * Items step for the collection wizard.
 *
 * @remarks
 * Step 2: Unified search for eprints, authors, and graph nodes.
 * Uses a cmdk-based Command component for keyboard navigation instead
 * of raw divs, and delegates node search to the same API functions
 * used by NodeAutocomplete (consolidated per task 2B).
 *
 * @packageDocumentation
 */

import { useState, useCallback, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  FileText,
  User,
  Globe,
  Search,
  Pencil,
  Loader2,
  FileUp,
  Building2,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInstantSearch } from '@/lib/hooks/use-search';
import { useAuthorSearch, type AuthorSearchResult } from '@/lib/hooks/use-author';
import { useDebounce } from '@/lib/hooks/use-eprint-search';
import { useRORSearch, type ROROrganization } from '@/lib/hooks/use-ror-search';
import { SUBKIND_BY_SLUG } from '@/components/knowledge-graph/types';
import type { EnrichedSearchHit } from '@/lib/api/schema';

import { BatchImportDialog } from '../batch-import-dialog';

import type { CollectionFormValues, CollectionItemFormData } from './types';
import { ITEM_TYPE_CONFIG } from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepItems component.
 */
export interface StepItemsProps {
  /** React Hook Form instance */
  form: UseFormReturn<CollectionFormValues>;
}

// =============================================================================
// NODE SEARCH HOOK
// =============================================================================

/**
 * Node search result for the unified items search.
 */
interface NodeSearchResult {
  uri: string;
  label: string;
  subkind?: string;
  kind?: string;
  description?: string;
  isPersonal?: boolean;
  /**
   * External identifier mappings on the node — DOI, arXiv, ORCID, ROR, etc.
   * Surfaced through so the collection wizard can carry them into
   * `CollectionItemFormData.metadata.externalIds` for rich Cosmik card
   * emission.
   */
  externalIds?: Array<{
    system: string;
    identifier: string;
    uri?: string;
    matchType?: 'exact' | 'close' | 'broader' | 'narrower' | 'related';
  }>;
}

/**
 * Searches knowledge graph nodes using the same API as NodeAutocomplete.
 *
 * @remarks
 * Extracts the node search logic from NodeAutocomplete into a reusable hook
 * so that the unified search in StepItems can include graph nodes without
 * duplicating fetch logic.
 *
 * @param query - Search query string (minimum 2 characters)
 * @param options - Search options
 * @returns Query result containing node search results
 */
export function useNodeSearch(query: string, options: { limit?: number; enabled?: boolean } = {}) {
  const { limit = 5, enabled = true } = options;

  return useQuery({
    queryKey: ['node-search-items', query, limit],
    queryFn: async (): Promise<NodeSearchResult[]> => {
      if (query.length < 2) return [];

      const params = new URLSearchParams({
        query,
        limit: String(limit),
        status: 'established',
      });

      try {
        const response = await fetch(`/xrpc/pub.chive.graph.searchNodes?${params.toString()}`);
        if (!response.ok) return [];

        const data = (await response.json()) as { nodes?: Record<string, unknown>[] };
        return (data.nodes ?? []).map((n) => ({
          uri: n['uri'] as string,
          label: n['label'] as string,
          subkind: n['subkind'] as string | undefined,
          kind: n['kind'] as string | undefined,
          description: n['description'] as string | undefined,
          isPersonal: (n['isPersonal'] as boolean | undefined) ?? false,
          externalIds: n['externalIds'] as NodeSearchResult['externalIds'],
        }));
      } catch {
        return [];
      }
    },
    enabled: enabled && query.length >= 2,
    staleTime: 60 * 1000,
  });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Returns initials from a display name (up to 2 characters).
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

// =============================================================================
// COLLECTION ITEM ROW
// =============================================================================

/**
 * Renders a single item in the items list with type badge, label, note, and remove.
 * Supports inline label editing and subkind-sensitive rendering.
 */
function CollectionItemRow({
  item,
  index,
  onNoteChange,
  onLabelChange,
  onRemove,
}: {
  item: CollectionItemFormData;
  index: number;
  onNoteChange: (index: number, note: string) => void;
  onLabelChange: (index: number, label: string) => void;
  onRemove: (index: number) => void;
}) {
  const [showNote, setShowNote] = useState(!!item.note);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabelValue, setEditLabelValue] = useState(item.label);
  const config = ITEM_TYPE_CONFIG[item.type] ?? {
    label: item.type,
    icon: FileText,
    color: 'bg-gray-100 text-gray-800',
  };
  const metadata = item.metadata;

  const confirmLabelEdit = useCallback(() => {
    const trimmed = editLabelValue.trim();
    if (trimmed && trimmed !== item.label) {
      onLabelChange(index, trimmed);
    }
    setIsEditingLabel(false);
  }, [editLabelValue, item.label, index, onLabelChange]);

  const cancelLabelEdit = useCallback(() => {
    setEditLabelValue(item.label);
    setIsEditingLabel(false);
  }, [item.label]);

  const renderItemContent = () => {
    if (item.type === 'author') {
      return (
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={metadata?.avatarUrl} alt={item.label} />
            <AvatarFallback>{getInitials(item.label)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {isEditingLabel ? (
              <Input
                value={editLabelValue}
                onChange={(e) => setEditLabelValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmLabelEdit();
                  } else if (e.key === 'Escape') {
                    cancelLabelEdit();
                  }
                }}
                onBlur={confirmLabelEdit}
                className="h-7 text-sm"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium truncate">{item.label}</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditLabelValue(item.label);
                    setIsEditingLabel(true);
                  }}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  aria-label="Edit label"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
            {metadata?.handle && (
              <p className="text-xs text-muted-foreground truncate">@{metadata.handle}</p>
            )}
          </div>
        </div>
      );
    }

    if (item.type === 'eprint') {
      return (
        <div className="flex-1 min-w-0 space-y-1">
          {isEditingLabel ? (
            <Input
              value={editLabelValue}
              onChange={(e) => setEditLabelValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmLabelEdit();
                } else if (e.key === 'Escape') {
                  cancelLabelEdit();
                }
              }}
              onBlur={confirmLabelEdit}
              className="h-7 text-sm"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1">
              <p className="text-sm font-medium truncate">{item.label}</p>
              <button
                type="button"
                onClick={() => {
                  setEditLabelValue(item.label);
                  setIsEditingLabel(true);
                }}
                className="text-muted-foreground hover:text-foreground p-0.5"
                aria-label="Edit label"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
          {metadata?.authors && metadata.authors.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">{metadata.authors.join(', ')}</p>
          )}
        </div>
      );
    }

    if (item.type === 'graphNode') {
      const subkindConfig = SUBKIND_BY_SLUG.get(metadata?.subkind ?? '');
      const NodeIcon = subkindConfig?.icon ?? Globe;

      return (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <NodeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            {isEditingLabel ? (
              <Input
                value={editLabelValue}
                onChange={(e) => setEditLabelValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmLabelEdit();
                  } else if (e.key === 'Escape') {
                    cancelLabelEdit();
                  }
                }}
                onBlur={confirmLabelEdit}
                className="h-7 text-sm"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium truncate">{item.label}</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditLabelValue(item.label);
                    setIsEditingLabel(true);
                  }}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  aria-label="Edit label"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1 mt-0.5">
              {subkindConfig && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  {subkindConfig.label}
                </Badge>
              )}
              {metadata?.isPersonal && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  Personal
                </Badge>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Default / AT-URI rendering
    return (
      <div className="flex-1 min-w-0 space-y-1">
        {isEditingLabel ? (
          <Input
            value={editLabelValue}
            onChange={(e) => setEditLabelValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmLabelEdit();
              } else if (e.key === 'Escape') {
                cancelLabelEdit();
              }
            }}
            onBlur={confirmLabelEdit}
            className="h-7 text-sm"
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium truncate">{item.label}</p>
            <button
              type="button"
              onClick={() => {
                setEditLabelValue(item.label);
                setIsEditingLabel(true);
              }}
              className="text-muted-foreground hover:text-foreground p-0.5"
              aria-label="Edit label"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
        <p className="text-xs text-muted-foreground truncate">{item.uri}</p>
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-3">
        <Badge variant="outline" className={cn('shrink-0 gap-1', config.color)}>
          <config.icon className="h-3 w-3" />
          {config.label}
        </Badge>
        <div className="flex-1 min-w-0 space-y-2">
          {renderItemContent()}
          <button
            type="button"
            onClick={() => setShowNote(!showNote)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {showNote ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showNote ? 'Hide note' : 'Add note'}
          </button>
          {showNote && (
            <Textarea
              value={item.note ?? ''}
              onChange={(e) => onNoteChange(index, e.target.value)}
              placeholder="Why is this item in the collection?"
              className="min-h-[60px] text-sm"
            />
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onRemove(index)}
          aria-label={`Remove ${item.label}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Items step: unified search for eprints, authors, and graph nodes.
 *
 * @remarks
 * Uses cmdk Command component for keyboard navigation in the search dropdown
 * (arrow keys, enter to select). Node search is consolidated with the same
 * API used by NodeAutocomplete, via the useNodeSearch hook.
 *
 * @param props - Component props
 * @returns Items step element
 */
export function StepItems({ form }: StepItemsProps) {
  const { setValue, watch } = form;
  const items = watch('items') ?? [];

  // Unified search state
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search hooks
  const eprintSearch = useInstantSearch(debouncedSearch);
  const authorSearch = useAuthorSearch(debouncedSearch, { limit: 5 });
  const nodeSearch = useNodeSearch(debouncedSearch, { limit: 5 });
  const rorSearch = useRORSearch(debouncedSearch, { limit: 5 });

  // Batch import dialog state
  const [batchImportOpen, setBatchImportOpen] = useState(false);

  // Custom event creation state
  const [showCustomEvent, setShowCustomEvent] = useState(false);
  const [customEventName, setCustomEventName] = useState('');
  const [customEventAcronym, setCustomEventAcronym] = useState('');

  // Collapsible AT-URI section
  const [showAtUriInput, setShowAtUriInput] = useState(false);

  const eprintHits = (eprintSearch.data?.hits ?? []) as unknown as EnrichedSearchHit[];
  const authorHits = authorSearch.data?.authors ?? [];
  const nodeResults = nodeSearch.data ?? [];
  const rorResults = rorSearch.data ?? [];
  const isSearching =
    eprintSearch.isLoading || authorSearch.isLoading || nodeSearch.isLoading || rorSearch.isLoading;
  const hasResults =
    eprintHits.length > 0 ||
    authorHits.length > 0 ||
    nodeResults.length > 0 ||
    rorResults.length > 0;

  const addItem = useCallback(
    (item: CollectionItemFormData) => {
      if (items.some((existing) => existing.uri === item.uri)) {
        toast.info('This item is already in the collection.');
        return;
      }
      setValue('items', [...items, item], { shouldDirty: true });
    },
    [items, setValue]
  );

  const removeItem = useCallback(
    (index: number) => {
      const updated = [...items];
      updated.splice(index, 1);
      setValue('items', updated, { shouldDirty: true });
    },
    [items, setValue]
  );

  const updateNote = useCallback(
    (index: number, note: string) => {
      const updated = [...items];
      updated[index] = { ...updated[index], note };
      setValue('items', updated, { shouldDirty: true });
    },
    [items, setValue]
  );

  const updateLabel = useCallback(
    (index: number, label: string) => {
      const updated = [...items];
      updated[index] = { ...updated[index], label };
      setValue('items', updated, { shouldDirty: true });
    },
    [items, setValue]
  );

  // AT-URI manual input
  const [atUriInput, setAtUriInput] = useState('');

  const handleAddAtUri = useCallback(() => {
    const trimmed = atUriInput.trim();
    if (!trimmed.startsWith('at://')) {
      toast.error('AT-URI must start with at://');
      return;
    }
    addItem({ uri: trimmed, type: 'at-uri', label: trimmed });
    setAtUriInput('');
  }, [atUriInput, addItem]);

  // Close popover and clear search after selecting an item
  const handleSelectAndClose = useCallback(
    (item: CollectionItemFormData) => {
      addItem(item);
      setSearchQuery('');
      setIsOpen(false);
    },
    [addItem]
  );

  // Batch import: append resolved items, skipping duplicates
  const handleBatchImport = useCallback(
    (imported: CollectionItemFormData[]) => {
      const existingUris = new Set(items.map((i) => i.uri));
      const newItems = imported.filter((item) => !existingUris.has(item.uri));
      if (newItems.length > 0) {
        setValue('items', [...items, ...newItems], { shouldDirty: true });
        toast.success(`Added ${newItems.length} item${newItems.length !== 1 ? 's' : ''}`);
      }
      if (newItems.length < imported.length) {
        const skipped = imported.length - newItems.length;
        toast.info(`${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped`);
      }
    },
    [items, setValue]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Add Items</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add eprints, authors, or graph nodes to your collection.
        </p>
      </div>

      {/* Unified search with cmdk Command for keyboard navigation */}
      <div className="flex gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length >= 2) setIsOpen(true);
                }}
                onFocus={() => {
                  if (searchQuery.length >= 2) setIsOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsOpen(false);
                }}
                placeholder="Search eprints, authors, or graph nodes..."
                className="pl-9"
              />
            </div>
          </PopoverTrigger>

          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command shouldFilter={false}>
              <CommandList className="max-h-[400px]">
                {/* Loading state */}
                {isSearching && !hasResults && (
                  <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </div>
                )}

                {/* No results */}
                {!isSearching && searchQuery.length >= 2 && !hasResults && (
                  <CommandEmpty className="py-4 text-center text-sm">
                    No results found for &quot;{searchQuery}&quot;
                  </CommandEmpty>
                )}

                {/* Eprint results */}
                {eprintHits.length > 0 && (
                  <CommandGroup
                    heading={
                      <span className="flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        Eprints
                      </span>
                    }
                  >
                    {eprintHits.slice(0, 5).map((hit) => (
                      <CommandItem
                        key={hit.uri}
                        value={`eprint-${hit.uri}`}
                        onSelect={() =>
                          handleSelectAndClose({
                            uri: hit.uri,
                            type: 'eprint',
                            label: hit.title ?? 'Untitled',
                            metadata: {
                              subkind: 'eprint',
                              authors: hit.authors?.map((a) => a.name ?? 'Unknown'),
                              description: hit.abstract,
                              publishedDate: hit.createdAt,
                            },
                          })
                        }
                        className="cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{hit.title ?? 'Untitled'}</p>
                          {hit.authors && hit.authors.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate">
                              {hit.authors.map((a) => a.name ?? 'Unknown').join(', ')}
                            </p>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* Author results */}
                {authorHits.length > 0 && (
                  <CommandGroup
                    heading={
                      <span className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        Authors
                      </span>
                    }
                  >
                    {authorHits.slice(0, 5).map((author: AuthorSearchResult) => (
                      <CommandItem
                        key={author.did}
                        value={`author-${author.did}`}
                        onSelect={() =>
                          handleSelectAndClose({
                            uri: author.did,
                            type: 'author',
                            label: author.displayName ?? author.handle ?? author.did,
                            metadata: {
                              avatarUrl: author.avatar,
                              handle: author.handle,
                            },
                          })
                        }
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarImage
                              src={author.avatar}
                              alt={author.displayName ?? author.handle}
                            />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(author.displayName ?? author.handle ?? '?')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {author.displayName ?? author.handle ?? author.did}
                            </p>
                            {author.handle && (
                              <p className="text-xs text-muted-foreground truncate">
                                @{author.handle}
                              </p>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* Graph node results */}
                {nodeResults.length > 0 && (
                  <CommandGroup
                    heading={
                      <span className="flex items-center gap-2">
                        <Globe className="h-3 w-3" />
                        Graph Nodes
                      </span>
                    }
                  >
                    {nodeResults.slice(0, 5).map((node) => {
                      const subkindConfig = SUBKIND_BY_SLUG.get(node.subkind ?? '');
                      const NodeIcon = subkindConfig?.icon ?? Globe;

                      return (
                        <CommandItem
                          key={node.uri}
                          value={`node-${node.uri}`}
                          onSelect={() =>
                            handleSelectAndClose({
                              uri: node.uri,
                              type: 'graphNode',
                              label: node.label,
                              metadata: {
                                subkind: node.subkind,
                                kind: node.kind,
                                description: node.description,
                                isPersonal: node.isPersonal,
                                externalIds: node.externalIds,
                                // Surface DOI / ISBN at the top level so
                                // Cosmik card emission picks them up without
                                // externalIds traversal.
                                doi: node.externalIds?.find((id) => id.system === 'doi')
                                  ?.identifier,
                                isbn: node.externalIds?.find((id) => id.system === 'isbn')
                                  ?.identifier,
                              },
                            })
                          }
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <NodeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="text-sm truncate">{node.label}</span>
                            {subkindConfig && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                                {subkindConfig.label}
                              </Badge>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

                {/* ROR institution results */}
                {rorResults.length > 0 && (
                  <CommandGroup
                    heading={
                      <span className="flex items-center gap-2">
                        <Building2 className="h-3 w-3" />
                        Institutions (ROR)
                      </span>
                    }
                  >
                    {rorResults.map((org: ROROrganization) => (
                      <CommandItem
                        key={org.id}
                        value={`ror-${org.id}`}
                        onSelect={() =>
                          handleSelectAndClose({
                            uri: org.id,
                            type: 'graphNode',
                            label: org.name,
                            metadata: {
                              subkind: 'institution',
                              kind: 'object',
                              rorId: org.id,
                              rorLabel: org.name,
                              country: org.country,
                            },
                          })
                        }
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="text-sm truncate">{org.name}</p>
                            {(org.city || org.country) && (
                              <p className="text-xs text-muted-foreground truncate">
                                {[org.city, org.country].filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* Custom event creation */}
                {searchQuery.length >= 2 && (
                  <CommandGroup
                    heading={
                      <span className="flex items-center gap-2">
                        <CalendarDays className="h-3 w-3" />
                        Create Event
                      </span>
                    }
                  >
                    <CommandItem
                      value="create-custom-event"
                      onSelect={() => {
                        setShowCustomEvent(true);
                        setCustomEventName(searchQuery);
                        setIsOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Create custom event &quot;{searchQuery}&quot;
                        </span>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={() => setBatchImportOpen(true)}
          title="Batch import DOIs or AT-URIs"
        >
          <FileUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Batch import dialog */}
      <BatchImportDialog
        open={batchImportOpen}
        onOpenChange={setBatchImportOpen}
        onImport={handleBatchImport}
      />

      {/* Custom event creation form */}
      {showCustomEvent && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Create Custom Event
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowCustomEvent(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-2">
              <Input
                value={customEventName}
                onChange={(e) => setCustomEventName(e.target.value)}
                placeholder="Conference name (e.g., NeurIPS 2025)"
                className="text-sm"
                autoFocus
              />
              <Input
                value={customEventAcronym}
                onChange={(e) => setCustomEventAcronym(e.target.value)}
                placeholder="Acronym (e.g., NeurIPS)"
                className="text-sm"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const name = customEventName.trim();
                if (!name) {
                  toast.error('Event name is required');
                  return;
                }
                addItem({
                  uri: `custom-event:${name}`,
                  type: 'graphNode',
                  label: name,
                  metadata: {
                    subkind: 'event',
                    kind: 'object',
                    conferenceName: name,
                    conferenceAcronym: customEventAcronym.trim() || undefined,
                  },
                });
                setCustomEventName('');
                setCustomEventAcronym('');
                setShowCustomEvent(false);
              }}
              disabled={!customEventName.trim()}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Event
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Collapsible AT-URI input */}
      <div>
        <button
          type="button"
          onClick={() => setShowAtUriInput(!showAtUriInput)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {showAtUriInput ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Add by AT-URI
        </button>
        {showAtUriInput && (
          <div className="flex gap-2 mt-2">
            <Input
              value={atUriInput}
              onChange={(e) => setAtUriInput(e.target.value)}
              placeholder="at://did:plc:abc/pub.chive.eprint.submission/123"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddAtUri();
                }
              }}
            />
            <Button
              type="button"
              onClick={handleAddAtUri}
              disabled={!atUriInput.trim().startsWith('at://')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}
      </div>

      {/* Item list */}
      {items.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Items ({items.length})</h3>
          {items.map((item, index) => (
            <CollectionItemRow
              key={`${item.uri}-${index}`}
              item={item}
              index={index}
              onNoteChange={updateNote}
              onLabelChange={updateLabel}
              onRemove={removeItem}
            />
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
          <p>No items added yet. Use the search above to find and add items.</p>
        </div>
      )}
    </div>
  );
}
