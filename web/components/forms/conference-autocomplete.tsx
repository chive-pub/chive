'use client';

/**
 * Conference autocomplete component with dual-source search.
 *
 * @remarks
 * Searches both Chive knowledge graph events and DBLP venues.
 * Supports creating new conferences via governance proposals.
 *
 * @example
 * ```tsx
 * <ConferenceAutocomplete
 *   onSelect={(conference) => {
 *     form.setValue('conferencePresentation.conferenceName', conference.name);
 *     if ('uri' in conference) {
 *       form.setValue('conferencePresentation.conferenceUri', conference.uri);
 *     }
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Building, Plus, Loader2, ExternalLink } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { logger } from '@/lib/observability';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const log = logger.child({ component: 'conference-autocomplete' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Chive event from knowledge graph.
 */
export interface ChiveEventConference {
  /** Source type */
  type: 'chive';
  /** Event ID */
  id: string;
  /** Event AT-URI */
  uri: string;
  /** Event name */
  name: string;
  /** Event acronym if available */
  acronym?: string;
  /** Status */
  status: string;
}

/**
 * DBLP venue entry.
 */
export interface DblpConference {
  /** Source type */
  type: 'dblp';
  /** Venue ID from DBLP */
  id: string;
  /** Full conference name */
  name: string;
  /** Conference acronym (e.g., NeurIPS, ICML) */
  acronym: string | null;
  /** Conference URL */
  url: string | null;
  /** Conference type */
  venueType: 'conference' | 'journal' | 'workshop' | 'other';
}

/**
 * Union type for conference results.
 */
export type Conference = ChiveEventConference | DblpConference;

/**
 * DBLP venue search response.
 */
interface DblpVenueResponse {
  result: {
    hits: {
      '@total': string;
      hit?: Array<{
        '@id': string;
        info: {
          venue: string;
          acronym?: string;
          type?: string;
          url?: string;
        };
      }>;
    };
  };
}

/**
 * Search results from both sources.
 */
interface DualSourceResults {
  chiveEvents: ChiveEventConference[];
  dblpVenues: DblpConference[];
}

/**
 * Props for ConferenceAutocomplete component.
 */
export interface ConferenceAutocompleteProps {
  /** Current conference name value */
  value?: string;
  /** Called when conference is selected */
  onSelect: (conference: Conference) => void;
  /** Called when input value changes */
  onChange?: (value: string) => void;
  /** Called when selection is cleared */
  onClear?: () => void;
  /** Called when "create new" is clicked */
  onCreateNew?: (name: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Input ID */
  id?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DBLP_API_URL = 'https://dblp.org/search/venue/api';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Maps DBLP venue type to our type.
 */
function mapVenueType(type?: string): DblpConference['venueType'] {
  if (type === 'Conference or Workshop') return 'conference';
  if (type === 'Journal') return 'journal';
  if (type?.toLowerCase().includes('workshop')) return 'workshop';
  return 'other';
}

/**
 * Transform DBLP API response to our conference type.
 */
function transformDblpResponse(data: DblpVenueResponse): DblpConference[] {
  const hits = data.result.hits.hit ?? [];
  return hits.map((hit) => ({
    type: 'dblp',
    id: hit['@id'],
    name: hit.info.venue,
    acronym: hit.info.acronym ?? null,
    url: hit.info.url ?? null,
    venueType: mapVenueType(hit.info.type),
  }));
}

/**
 * Search DBLP venues.
 */
async function searchDblpVenues(query: string): Promise<DblpConference[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    h: '10',
  });

  const response = await fetch(`${DBLP_API_URL}?${params.toString()}`);

  if (!response.ok) {
    log.error('DBLP search failed', undefined, {
      query,
      status: response.status,
      statusText: response.statusText,
    });
    return [];
  }

  const data: DblpVenueResponse = await response.json();
  return transformDblpResponse(data);
}

// =============================================================================
// DUAL-SOURCE SEARCH HOOK
// =============================================================================

/**
 * Custom hook for searching both Chive events and DBLP venues.
 */
function useDualSourceSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DualSourceResults>({
    chiveEvents: [],
    dblpVenues: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search
  const debouncedSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults({ chiveEvents: [], dblpVenues: [] });
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    try {
      // Query both sources in parallel
      const [chiveResponse, dblpResponse] = await Promise.allSettled([
        // Chive knowledge graph - using unified node search
        fetch(
          `/xrpc/pub.chive.graph.searchNodes?query=${encodeURIComponent(searchQuery)}&subkind=event&kind=object&status=established&limit=5`,
          { signal: controller.signal }
        ),
        // DBLP API (only if query is 3+ chars)
        searchQuery.length >= 3 ? searchDblpVenues(searchQuery) : Promise.resolve([]),
      ]);

      // Parse Chive results - map unified node format to ChiveEventConference
      let chiveEvents: ChiveEventConference[] = [];
      if (chiveResponse.status === 'fulfilled' && chiveResponse.value?.ok) {
        const chiveData = await chiveResponse.value.json();
        chiveEvents = (chiveData.nodes ?? []).map(
          (node: {
            id: string;
            uri: string;
            label: string;
            metadata?: { acronym?: string };
            status: string;
          }) => ({
            type: 'chive',
            id: node.id,
            uri: node.uri,
            name: node.label,
            acronym: node.metadata?.acronym,
            status: node.status,
          })
        );
      }

      // Parse DBLP results
      let dblpVenues: DblpConference[] = [];
      if (dblpResponse.status === 'fulfilled') {
        dblpVenues = dblpResponse.value;
      }

      // Deduplicate: filter out DBLP matches already in Chive (by name)
      const chiveNames = new Set(chiveEvents.map((event) => event.name.toLowerCase()));
      const filteredDblp = dblpVenues.filter((venue) => !chiveNames.has(venue.name.toLowerCase()));

      setResults({
        chiveEvents,
        dblpVenues: filteredDblp,
      });
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        log.error('Conference search error', error, { query: searchQuery });
        setResults({ chiveEvents: [], dblpVenues: [] });
      }
    } finally {
      setIsSearching(false);
    }
  }, 400);

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const hasResults = results.chiveEvents.length > 0 || results.dblpVenues.length > 0;

  return {
    query,
    setQuery,
    results,
    hasResults,
    isSearching,
    clearResults: () => setResults({ chiveEvents: [], dblpVenues: [] }),
  };
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Render a single conference result item.
 */
function ConferenceResultItem({ conference }: { conference: Conference }) {
  if (conference.type === 'chive') {
    return (
      <div className="space-y-1">
        <div className="flex items-start gap-2">
          <Building className="h-4 w-4 shrink-0 mt-0.5 text-purple-600" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm line-clamp-1">{conference.name}</div>
            {conference.acronym && (
              <div className="text-xs text-muted-foreground mt-0.5">
                <span className="font-mono text-purple-600">{conference.acronym}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <Building className="h-4 w-4 shrink-0 mt-0.5 text-purple-600" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm line-clamp-1">{conference.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            {conference.acronym && (
              <span className="font-mono text-purple-600">{conference.acronym}</span>
            )}
            <span className="px-1.5 py-0.5 rounded bg-muted capitalize">
              {conference.venueType}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Conference autocomplete component.
 *
 * @param props - Component props
 * @returns Conference autocomplete element
 */
export function ConferenceAutocomplete({
  value,
  onSelect,
  onChange,
  onClear,
  onCreateNew,
  placeholder = 'Search conferences...',
  disabled = false,
  className,
  id,
}: ConferenceAutocompleteProps) {
  const { query, setQuery, results, hasResults, isSearching, clearResults } = useDualSourceSearch();
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Sync external value with internal query
  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
    }
  }, [value, query, setQuery]);

  const handleSelect = useCallback(
    (conference: Conference) => {
      onSelect(conference);
      setQuery(conference.name);
      clearResults();
      setShowResults(false);
      onChange?.(conference.name);
    },
    [onSelect, setQuery, clearResults, onChange]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    clearResults();
    setShowResults(false);
    onClear?.();
    onChange?.('');
  }, [setQuery, clearResults, onClear, onChange]);

  const handleCreateNew = useCallback(() => {
    if (onCreateNew && query.trim()) {
      onCreateNew(query.trim());
      setQuery('');
      clearResults();
      setShowResults(false);
    }
  }, [onCreateNew, query, clearResults, setQuery]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setQuery(newValue);
      onChange?.(newValue);
      setShowResults(true);
    },
    [setQuery, onChange]
  );

  const handleInputFocus = useCallback(() => {
    if (hasResults || query.trim().length >= 2) {
      setShowResults(true);
    }
  }, [hasResults, query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowResults(false);
    }
  }, []);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-8"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        )}
        {isSearching && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Sectioned results dropdown */}
      {showResults && (hasResults || (query.trim().length >= 2 && !isSearching)) && (
        <div
          ref={resultsRef}
          className="absolute z-50 w-full rounded-md border bg-popover shadow-md mt-1"
        >
          <div className="max-h-72 overflow-y-auto">
            {/* Chive Events Section */}
            {results.chiveEvents.length > 0 && (
              <div>
                <div className="sticky top-0 bg-muted/80 px-2 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                  Chive Events
                </div>
                <div className="p-1">
                  {results.chiveEvents.map((event) => (
                    <button
                      key={event.uri}
                      type="button"
                      onClick={() => handleSelect(event)}
                      className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    >
                      <ConferenceResultItem conference={event} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* DBLP Venues Section */}
            {results.dblpVenues.length > 0 && (
              <div>
                <div className="sticky top-0 bg-muted/80 px-2 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                  DBLP Venues
                </div>
                <div className="p-1">
                  {results.dblpVenues.map((venue) => (
                    <button
                      key={venue.id}
                      type="button"
                      onClick={() => handleSelect(venue)}
                      className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    >
                      <ConferenceResultItem conference={venue} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create new conference option */}
            {onCreateNew && query.trim().length >= 2 && (
              <div className="border-t p-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleCreateNew}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create new conference: &quot;{query.trim()}&quot;
                </Button>
              </div>
            )}

            {/* Empty state */}
            {!hasResults && query.trim().length >= 2 && !isSearching && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No conferences found. Try a different search term.
                {onCreateNew && (
                  <div className="mt-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleCreateNew}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create new conference
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
