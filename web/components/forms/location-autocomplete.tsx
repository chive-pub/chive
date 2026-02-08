'use client';

/**
 * Location autocomplete component with Wikidata search.
 *
 * @remarks
 * Searches Wikidata for locations (cities, regions, countries).
 * Displays location hierarchy (city, region, country).
 *
 * @example
 * ```tsx
 * <LocationAutocomplete
 *   value={location}
 *   onSelect={(location) => {
 *     form.setValue('conferencePresentation.conferenceLocation', location.displayName);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { MapPin, Loader2, ExternalLink } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { logger } from '@/lib/observability';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const log = logger.child({ component: 'location-autocomplete' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Location result from Wikidata.
 */
export interface LocationResult {
  /** Wikidata Q ID */
  wikidataId: string;
  /** Display name */
  displayName: string;
  /** City name if available */
  city?: string;
  /** Region/state name if available */
  region?: string;
  /** Country name */
  country: string;
  /** Full location hierarchy */
  hierarchy: string[];
}

/**
 * Wikidata search API response.
 */
interface WikidataSearchResponse {
  search: Array<{
    id: string;
    label: string;
    description?: string;
    url: string;
  }>;
}

/**
 * Wikidata entity details response.
 */
interface WikidataEntityResponse {
  entities: Record<
    string,
    {
      id: string;
      labels?: Record<string, { value: string }>;
      claims?: {
        P131?: Array<{ mainsnak: { datavalue?: { value: { id?: string } } } }>; // located in
        P17?: Array<{ mainsnak: { datavalue?: { value: { id?: string } } } }>; // country
      };
    }
  >;
}

/**
 * Props for LocationAutocomplete component.
 */
export interface LocationAutocompleteProps {
  /** Current location value */
  value?: string;
  /** Called when a location is selected */
  onSelect: (location: LocationResult) => void;
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

const WIKIDATA_SEARCH_API = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_ENTITY_API = 'https://www.wikidata.org/w/api.php';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Search Wikidata for locations.
 */
async function searchWikidataLocations(query: string): Promise<LocationResult[]> {
  const params = new URLSearchParams({
    action: 'wbsearchentities',
    search: query,
    language: 'en',
    format: 'json',
    type: 'item',
    limit: '10',
    origin: '*',
  });

  try {
    const response = await fetch(`${WIKIDATA_SEARCH_API}?${params.toString()}`);
    if (!response.ok) {
      log.error('Wikidata search failed', undefined, {
        query,
        status: response.status,
        statusText: response.statusText,
      });
      return [];
    }

    const data: WikidataSearchResponse = await response.json();
    const results: LocationResult[] = [];

    // Fetch entity details for each result to get location hierarchy
    for (const item of data.search.slice(0, 5)) {
      const entityId = item.id;
      const entityParams = new URLSearchParams({
        action: 'wbgetentities',
        ids: entityId,
        props: 'labels|claims',
        format: 'json',
        origin: '*',
      });

      try {
        const entityResponse = await fetch(`${WIKIDATA_ENTITY_API}?${entityParams.toString()}`);
        if (!entityResponse.ok) continue;

        const entityData: WikidataEntityResponse = await entityResponse.json();
        const entity = entityData.entities[entityId];
        if (!entity) continue;

        // Extract country from claims
        const countryClaim = entity.claims?.P17?.[0]?.mainsnak?.datavalue?.value?.id;
        const countryLabel = countryClaim
          ? (entityData.entities[countryClaim]?.labels?.en?.value ?? 'Unknown')
          : undefined;

        // Build hierarchy
        const hierarchy: string[] = [];
        if (item.label) hierarchy.push(item.label);
        if (countryLabel) hierarchy.push(countryLabel);

        results.push({
          wikidataId: entityId,
          displayName: item.label,
          country: countryLabel ?? 'Unknown',
          hierarchy,
        });
      } catch {
        // If entity fetch fails, still add basic result
        results.push({
          wikidataId: entityId,
          displayName: item.label,
          country: 'Unknown',
          hierarchy: [item.label],
        });
      }
    }

    return results;
  } catch (error) {
    log.error('Wikidata location search error', error, { query });
    return [];
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Render a single location result item.
 */
function LocationResultItem({ location }: { location: LocationResult }) {
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm line-clamp-1">{location.displayName}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {location.hierarchy.length > 1
              ? location.hierarchy.slice(1).join(', ')
              : location.country}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Location autocomplete input with Wikidata search.
 *
 * @param props - Component props
 * @returns Location autocomplete element
 */
export function LocationAutocomplete({
  value,
  onSelect,
  onChange,
  onClear,
  placeholder = 'Search locations...',
  disabled = false,
  className,
  id,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value ?? '');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search
  const debouncedSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
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
      const locations = await searchWikidataLocations(searchQuery);
      if (!controller.signal.aborted) {
        setResults(locations);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        log.error('Location search error', error, { query: searchQuery });
        setResults([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, 400);

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  // Sync external value with internal query
  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
    }
  }, [value, query]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSelect = useCallback(
    (location: LocationResult) => {
      onSelect(location);
      setQuery(location.displayName);
      setResults([]);
      setShowResults(false);
      onChange?.(location.displayName);
    },
    [onSelect, onChange]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    onClear?.();
    onChange?.('');
  }, [onClear, onChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setQuery(newValue);
      onChange?.(newValue);
      setShowResults(true);
    },
    [onChange]
  );

  const handleInputFocus = useCallback(() => {
    if (results.length > 0 || query.trim().length >= 2) {
      setShowResults(true);
    }
  }, [results.length, query]);

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

      {/* Results dropdown */}
      {showResults && (results.length > 0 || (query.trim().length >= 2 && !isSearching)) && (
        <div
          ref={resultsRef}
          className="absolute z-50 w-full rounded-md border bg-popover shadow-md mt-1"
        >
          <div className="max-h-72 overflow-y-auto">
            {results.length > 0 ? (
              <div className="p-1">
                {results.map((location) => (
                  <button
                    key={location.wikidataId}
                    type="button"
                    onClick={() => handleSelect(location)}
                    className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <LocationResultItem location={location} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No locations found. Try a different search term.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
