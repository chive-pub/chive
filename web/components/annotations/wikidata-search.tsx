'use client';

/**
 * Wikidata entity search component.
 *
 * @remarks
 * Searches Wikidata API for entities matching the query.
 * Used for linking text spans to Wikidata Q-IDs.
 *
 * @example
 * ```tsx
 * <WikidataSearch
 *   query="neural networks"
 *   onSelect={handleSelect}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2 } from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Wikidata entity result.
 */
export interface WikidataEntity {
  /** Q-ID (e.g., "Q43479") */
  qid: string;

  /** Label in current language */
  label: string;

  /** Description */
  description?: string;

  /** Wikidata URL */
  url: string;
}

/**
 * Props for WikidataSearch.
 */
export interface WikidataSearchProps {
  /** Search query */
  query: string;

  /** Callback when entity is selected */
  onSelect: (entity: WikidataEntity) => void;

  /** Language for labels */
  language?: string;

  /** Maximum results */
  limit?: number;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// API
// =============================================================================

interface WikidataSearchResult {
  search: Array<{
    id: string;
    label: string;
    description?: string;
    url: string;
  }>;
}

async function searchWikidata(
  query: string,
  language: string,
  limit: number
): Promise<WikidataEntity[]> {
  if (query.length < 2) return [];

  const params = new URLSearchParams({
    action: 'wbsearchentities',
    search: query,
    language,
    limit: String(limit),
    format: 'json',
    origin: '*',
  });

  const response = await fetch(`https://www.wikidata.org/w/api.php?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Wikidata search failed');
  }

  const data: WikidataSearchResult = await response.json();

  return data.search.map((item) => {
    // Normalize URL to ensure it has https:// protocol
    // Wikidata API may return protocol-relative URLs (//www.wikidata.org/...)
    // or URLs without any protocol
    let url = item.url || `https://www.wikidata.org/wiki/${item.id}`;
    if (url.startsWith('//')) {
      url = `https:${url}`;
    } else if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    return {
      qid: item.id,
      label: item.label,
      description: item.description,
      url,
    };
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Search Wikidata entities.
 *
 * @param props - Component props
 * @returns Search results element
 */
export function WikidataSearch({
  query,
  onSelect,
  language = 'en',
  limit = 10,
  className,
}: WikidataSearchProps) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const {
    data: results,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['wikidata', 'search', debouncedQuery, language, limit],
    queryFn: () => searchWikidata(debouncedQuery, language, limit),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return (
    <Command className={cn('w-full overflow-hidden', className)} data-testid="wikidata-search">
      <CommandList className="max-h-none overflow-visible">
        {isLoading && (
          <div className="flex items-center justify-center py-6" role="status" aria-label="Loading">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="py-6 text-center text-sm text-destructive">Search failed. Try again.</div>
        )}

        {!isLoading && !error && query.length < 2 && (
          <CommandEmpty>Type at least 2 characters to search</CommandEmpty>
        )}

        {!isLoading && !error && query.length >= 2 && results?.length === 0 && (
          <CommandEmpty>No Wikidata entities found</CommandEmpty>
        )}

        {results && results.length > 0 && (
          <CommandGroup heading="Wikidata">
            {results.map((entity) => (
              <CommandItem
                key={entity.qid}
                value={entity.qid}
                onSelect={() => onSelect(entity)}
                className="cursor-pointer overflow-hidden"
              >
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate min-w-0 flex-1">{entity.label}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{entity.qid}</span>
                  </div>
                  {entity.description && (
                    <p className="text-xs text-muted-foreground truncate">{entity.description}</p>
                  )}
                </div>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}
