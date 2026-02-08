'use client';

/**
 * Funder autocomplete input with dual-source search.
 *
 * @remarks
 * Searches both Chive knowledge graph institutions and CrossRef Funder Registry.
 * Returns funder name, URI (for knowledge graph nodes), DOI (for CrossRef), and ROR ID.
 *
 * @example
 * ```tsx
 * <FunderAutocomplete
 *   value={funderName}
 *   onSelect={(funder) => {
 *     form.setValue('funding.funderName', funder.name);
 *     if ('uri' in funder) {
 *       form.setValue('funding.funderUri', funder.uri);
 *       if (funder.rorId) {
 *         form.setValue('funding.funderRor', funder.rorId);
 *       }
 *     } else {
 *       form.setValue('funding.funderDoi', funder.doi);
 *     }
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { MapPin, ExternalLink, Loader2 } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { logger } from '@/lib/observability';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const log = logger.child({ component: 'funder-autocomplete' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Chive institution from knowledge graph.
 */
export interface ChiveInstitutionFunder {
  /** Source type */
  type: 'chive';
  /** Institution ID */
  id: string;
  /** Institution AT-URI */
  uri: string;
  /** Institution name */
  name: string;
  /** Country */
  country?: string;
  /** City */
  city?: string;
  /** ROR ID if available */
  rorId?: string;
  /** Wikidata ID if available */
  wikidataId?: string;
  /** Status */
  status: string;
}

/**
 * CrossRef Funder result.
 */
export interface CrossRefFunder {
  /** Source type */
  type: 'crossref';
  /** Funder DOI (e.g., 10.13039/100000002) */
  doi: string;
  /** Funder name */
  name: string;
  /** Alternative names */
  altNames: string[];
  /** Location (country/region) */
  location: string | null;
  /** Funder URI */
  uri: string;
  /** Number of works funded */
  worksCount: number | null;
}

/**
 * Union type for funder results.
 */
export type FunderResult = ChiveInstitutionFunder | CrossRefFunder;

/**
 * CrossRef Funders API response shape.
 */
interface CrossRefFundersResponse {
  status: string;
  message: {
    items: Array<{
      id: string;
      name: string;
      'alt-names'?: string[];
      location?: string;
      uri: string;
      'work-count'?: number;
    }>;
  };
}

/**
 * Search results from both sources.
 */
interface DualSourceResults {
  chiveInstitutions: ChiveInstitutionFunder[];
  crossrefFunders: CrossRefFunder[];
}

/**
 * Props for FunderAutocomplete component.
 */
export interface FunderAutocompleteProps {
  /** Current funder name value */
  value?: string;
  /** Called when a funder is selected */
  onSelect: (funder: FunderResult) => void;
  /** Called when input value changes */
  onChange?: (value: string) => void;
  /** Called when selection is cleared */
  onClear?: () => void;
  /** Input placeholder */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Input ID */
  id?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CROSSREF_FUNDERS_URL = 'https://api.crossref.org/funders';
const CROSSREF_POLITE_EMAIL = 'contact@chive.pub';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Transform CrossRef Funders API response.
 */
function transformFundersResponse(data: CrossRefFundersResponse): CrossRefFunder[] {
  return data.message.items.map((item) => ({
    type: 'crossref',
    doi: item.id,
    name: item.name,
    altNames: item['alt-names'] ?? [],
    location: item.location ?? null,
    uri: item.uri,
    worksCount: item['work-count'] ?? null,
  }));
}

/**
 * Search CrossRef for funders by query.
 */
async function searchCrossRefFunders(query: string): Promise<CrossRefFunder[]> {
  const params = new URLSearchParams({
    query,
    rows: '10',
    mailto: CROSSREF_POLITE_EMAIL,
  });

  const response = await fetch(`${CROSSREF_FUNDERS_URL}?${params.toString()}`);
  if (!response.ok) {
    log.error('CrossRef funders search failed', undefined, {
      query,
      status: response.status,
      statusText: response.statusText,
    });
    return [];
  }

  const data: CrossRefFundersResponse = await response.json();
  return transformFundersResponse(data);
}

// =============================================================================
// DUAL-SOURCE SEARCH HOOK
// =============================================================================

/**
 * Custom hook for searching both Chive institutions and CrossRef funders.
 */
function useDualSourceSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DualSourceResults>({
    chiveInstitutions: [],
    crossrefFunders: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search
  const debouncedSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults({ chiveInstitutions: [], crossrefFunders: [] });
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
      const [chiveResponse, crossrefResponse] = await Promise.allSettled([
        // Chive knowledge graph - using unified node search
        fetch(
          `/xrpc/pub.chive.graph.searchNodes?query=${encodeURIComponent(searchQuery)}&subkind=institution&kind=object&status=established&limit=5`,
          { signal: controller.signal }
        ),
        // CrossRef API (only if query is 3+ chars)
        searchQuery.length >= 3 ? searchCrossRefFunders(searchQuery) : Promise.resolve([]),
      ]);

      // Parse Chive results - map unified node format to ChiveInstitutionFunder
      let chiveInstitutions: ChiveInstitutionFunder[] = [];
      if (chiveResponse.status === 'fulfilled' && chiveResponse.value?.ok) {
        const chiveData = await chiveResponse.value.json();
        chiveInstitutions = (chiveData.nodes ?? []).map(
          (node: {
            id: string;
            uri: string;
            label: string;
            metadata?: { country?: string; city?: string };
            externalIds?: Array<{ system: string; identifier: string }>;
            status: string;
          }) => ({
            type: 'chive',
            id: node.id,
            uri: node.uri,
            name: node.label,
            country: node.metadata?.country,
            city: node.metadata?.city,
            rorId: node.externalIds?.find((ext) => ext.system === 'ror')?.identifier,
            wikidataId: node.externalIds?.find((ext) => ext.system === 'wikidata')?.identifier,
            status: node.status,
          })
        );
      }

      // Parse CrossRef results
      let crossrefFunders: CrossRefFunder[] = [];
      if (crossrefResponse.status === 'fulfilled') {
        crossrefFunders = crossrefResponse.value;
      }

      // Deduplicate: filter out CrossRef funders that match Chive institutions by name
      // Note: ROR ID matching is not possible since CrossRef funder metadata lacks ROR IDs.
      // A DOI-to-ROR mapping service would be needed for ROR-based deduplication.
      const chiveNames = new Set(chiveInstitutions.map((inst) => inst.name.toLowerCase()));
      const filteredCrossref = crossrefFunders.filter((funder) => {
        // Skip if name matches a Chive institution
        return !chiveNames.has(funder.name.toLowerCase());
      });

      setResults({
        chiveInstitutions,
        crossrefFunders: filteredCrossref,
      });
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        log.error('Funder search error', error, { query: searchQuery });
        setResults({ chiveInstitutions: [], crossrefFunders: [] });
      }
    } finally {
      setIsSearching(false);
    }
  }, 300);

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

  const hasResults = results.chiveInstitutions.length > 0 || results.crossrefFunders.length > 0;

  return {
    query,
    setQuery,
    results,
    hasResults,
    isSearching,
    clearResults: () => setResults({ chiveInstitutions: [], crossrefFunders: [] }),
  };
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Render a single funder result item.
 */
function FunderResultItem({ funder }: { funder: FunderResult }) {
  if (funder.type === 'chive') {
    return (
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium line-clamp-2">{funder.name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {funder.city && funder.country && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {[funder.city, funder.country].filter(Boolean).join(', ')}
            </span>
          )}
          {funder.rorId && (
            <span className="flex items-center gap-1 font-mono text-xs">
              <ExternalLink className="h-3 w-3 shrink-0" />
              ROR linked
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium line-clamp-2">{funder.name}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {funder.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            {funder.location}
          </span>
        )}
        <span className="flex items-center gap-1 font-mono">
          <ExternalLink className="h-3 w-3 shrink-0" />
          {funder.doi}
        </span>
      </div>
      {funder.altNames.length > 0 && (
        <div className="text-xs text-muted-foreground truncate">
          Also known as: {funder.altNames.slice(0, 2).join(', ')}
          {funder.altNames.length > 2 && '...'}
        </div>
      )}
    </div>
  );
}

/**
 * Funder autocomplete input with dual-source search.
 *
 * @param props - Component props
 * @returns Funder autocomplete element
 */
export function FunderAutocomplete({
  value,
  onSelect,
  onChange,
  onClear,
  placeholder = 'Search funding organizations...',
  disabled = false,
  className,
  id,
}: FunderAutocompleteProps) {
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
    (funder: FunderResult) => {
      onSelect(funder);
      setQuery(funder.name);
      clearResults();
      setShowResults(false);
      onChange?.(funder.name);
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
            {/* Chive Institutions Section */}
            {results.chiveInstitutions.length > 0 && (
              <div>
                <div className="sticky top-0 bg-muted/80 px-2 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                  Chive Institutions
                </div>
                <div className="p-1">
                  {results.chiveInstitutions.map((inst) => (
                    <button
                      key={inst.uri}
                      type="button"
                      onClick={() => handleSelect(inst)}
                      className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    >
                      <FunderResultItem funder={inst} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CrossRef Funders Section */}
            {results.crossrefFunders.length > 0 && (
              <div>
                <div className="sticky top-0 bg-muted/80 px-2 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                  CrossRef Funders
                </div>
                <div className="p-1">
                  {results.crossrefFunders.map((funder) => (
                    <button
                      key={funder.doi}
                      type="button"
                      onClick={() => handleSelect(funder)}
                      className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    >
                      <FunderResultItem funder={funder} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!hasResults && query.trim().length >= 2 && !isSearching && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No funders found. Try a different search term.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
