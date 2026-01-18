'use client';

/**
 * Facet value autocomplete component.
 *
 * @remarks
 * Searches facet values in the knowledge graph. Uses searchNodes for dimensions
 * with subkinds (form-genre → paper-type), and falls back to hardcoded options
 * when no backend data is available.
 *
 * @example
 * ```tsx
 * <FacetAutocomplete
 *   dimension="energy"
 *   onSelect={(facet) => handleSelect(facet)}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Layers, Search, Loader2, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/lib/hooks/use-eprint-search';
import type { FacetDimension } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Facet value suggestion.
 */
export interface FacetSuggestion {
  /** Facet value slug (used as ID) */
  id: string;
  /** Display label */
  label: string;
  /** Description */
  description: string | null;
  /** Facet dimension (PMEST or FAST) */
  dimension: FacetDimension;
  /** Number of eprints tagged with this facet */
  usageCount: number;
}

/**
 * Props for FacetAutocomplete component.
 */
export interface FacetAutocompleteProps {
  /** Filter to specific dimension (required for value search) */
  dimension: FacetDimension;
  /** Current selected facet value slug */
  value?: string;
  /** Called when a facet value is selected */
  onSelect: (facet: FacetSuggestion) => void;
  /** Called when selection is cleared */
  onClear?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Input ID for accessibility */
  id?: string;
}

// =============================================================================
// DIMENSION CONFIGURATION
// =============================================================================

const DIMENSION_LABELS: Record<FacetDimension, string> = {
  personality: 'Discipline',
  matter: 'Subject Matter',
  energy: 'Methodology',
  space: 'Geographic Focus',
  time: 'Time Period',
  person: 'Person',
  organization: 'Organization',
  event: 'Event',
  work: 'Work',
  'form-genre': 'Document Type',
};

/**
 * Maps dimensions to their search strategy.
 */
const DIMENSION_SUBKINDS: Partial<Record<FacetDimension, string>> = {
  'form-genre': 'paper-type',
  personality: 'field',
};

/**
 * Fallback options when API has no data.
 */
const FALLBACK_OPTIONS: Record<FacetDimension, FacetSuggestion[]> = {
  'form-genre': [
    {
      id: 'original-research',
      label: 'Original Research',
      description: 'Primary research article',
      dimension: 'form-genre',
      usageCount: 0,
    },
    {
      id: 'review',
      label: 'Review',
      description: 'Literature review',
      dimension: 'form-genre',
      usageCount: 0,
    },
    {
      id: 'systematic-review',
      label: 'Systematic Review',
      description: 'Systematic literature review',
      dimension: 'form-genre',
      usageCount: 0,
    },
    {
      id: 'meta-analysis',
      label: 'Meta-Analysis',
      description: 'Statistical synthesis of studies',
      dimension: 'form-genre',
      usageCount: 0,
    },
    {
      id: 'case-study',
      label: 'Case Study',
      description: 'In-depth case examination',
      dimension: 'form-genre',
      usageCount: 0,
    },
    {
      id: 'commentary',
      label: 'Commentary',
      description: 'Commentary or opinion piece',
      dimension: 'form-genre',
      usageCount: 0,
    },
    {
      id: 'methods-paper',
      label: 'Methods Paper',
      description: 'Methodology description',
      dimension: 'form-genre',
      usageCount: 0,
    },
    {
      id: 'thesis',
      label: 'Thesis/Dissertation',
      description: 'Academic thesis',
      dimension: 'form-genre',
      usageCount: 0,
    },
    {
      id: 'conference-paper',
      label: 'Conference Paper',
      description: 'Conference proceeding',
      dimension: 'form-genre',
      usageCount: 0,
    },
    {
      id: 'preprint',
      label: 'Preprint',
      description: 'Pre-publication manuscript',
      dimension: 'form-genre',
      usageCount: 0,
    },
  ],
  energy: [
    {
      id: 'qualitative-research',
      label: 'Qualitative Research',
      description: 'Non-numerical data analysis',
      dimension: 'energy',
      usageCount: 0,
    },
    {
      id: 'quantitative-research',
      label: 'Quantitative Research',
      description: 'Statistical/numerical analysis',
      dimension: 'energy',
      usageCount: 0,
    },
    {
      id: 'mixed-methods',
      label: 'Mixed Methods',
      description: 'Qualitative and quantitative',
      dimension: 'energy',
      usageCount: 0,
    },
    {
      id: 'meta-analysis',
      label: 'Meta-Analysis',
      description: 'Statistical synthesis',
      dimension: 'energy',
      usageCount: 0,
    },
    {
      id: 'systematic-review',
      label: 'Systematic Review',
      description: 'Systematic literature review',
      dimension: 'energy',
      usageCount: 0,
    },
    {
      id: 'randomized-controlled-trial',
      label: 'Randomized Controlled Trial',
      description: 'RCT methodology',
      dimension: 'energy',
      usageCount: 0,
    },
    {
      id: 'observational-study',
      label: 'Observational Study',
      description: 'Non-interventional research',
      dimension: 'energy',
      usageCount: 0,
    },
    {
      id: 'machine-learning',
      label: 'Machine Learning',
      description: 'ML-based analysis',
      dimension: 'energy',
      usageCount: 0,
    },
    {
      id: 'simulation',
      label: 'Simulation',
      description: 'Computational modeling',
      dimension: 'energy',
      usageCount: 0,
    },
    {
      id: 'survey-research',
      label: 'Survey Research',
      description: 'Survey-based methodology',
      dimension: 'energy',
      usageCount: 0,
    },
  ],
  space: [
    {
      id: 'global',
      label: 'Global',
      description: 'Worldwide scope',
      dimension: 'space',
      usageCount: 0,
    },
    {
      id: 'europe',
      label: 'Europe',
      description: 'European region',
      dimension: 'space',
      usageCount: 0,
    },
    {
      id: 'north-america',
      label: 'North America',
      description: 'North American region',
      dimension: 'space',
      usageCount: 0,
    },
    { id: 'asia', label: 'Asia', description: 'Asian region', dimension: 'space', usageCount: 0 },
    {
      id: 'africa',
      label: 'Africa',
      description: 'African region',
      dimension: 'space',
      usageCount: 0,
    },
    {
      id: 'south-america',
      label: 'South America',
      description: 'South American region',
      dimension: 'space',
      usageCount: 0,
    },
    {
      id: 'oceania',
      label: 'Oceania',
      description: 'Oceanian region',
      dimension: 'space',
      usageCount: 0,
    },
    {
      id: 'middle-east',
      label: 'Middle East',
      description: 'Middle Eastern region',
      dimension: 'space',
      usageCount: 0,
    },
    {
      id: 'southeast-asia',
      label: 'Southeast Asia',
      description: 'Southeast Asian region',
      dimension: 'space',
      usageCount: 0,
    },
    {
      id: 'sub-saharan-africa',
      label: 'Sub-Saharan Africa',
      description: 'Sub-Saharan African region',
      dimension: 'space',
      usageCount: 0,
    },
  ],
  time: [
    {
      id: '21st-century',
      label: '21st Century',
      description: '2001-present',
      dimension: 'time',
      usageCount: 0,
    },
    {
      id: '20th-century',
      label: '20th Century',
      description: '1901-2000',
      dimension: 'time',
      usageCount: 0,
    },
    {
      id: '19th-century',
      label: '19th Century',
      description: '1801-1900',
      dimension: 'time',
      usageCount: 0,
    },
    {
      id: 'contemporary',
      label: 'Contemporary',
      description: '2010-present',
      dimension: 'time',
      usageCount: 0,
    },
    {
      id: 'digital-age',
      label: 'Digital Age',
      description: '1970s-present',
      dimension: 'time',
      usageCount: 0,
    },
    {
      id: 'cold-war-era',
      label: 'Cold War Era',
      description: '1947-1991',
      dimension: 'time',
      usageCount: 0,
    },
    {
      id: 'world-war-ii-era',
      label: 'World War II Era',
      description: '1939-1945',
      dimension: 'time',
      usageCount: 0,
    },
    {
      id: 'interwar-period',
      label: 'Interwar Period',
      description: '1918-1939',
      dimension: 'time',
      usageCount: 0,
    },
    {
      id: 'industrial-revolution',
      label: 'Industrial Revolution',
      description: 'c. 1760-1840',
      dimension: 'time',
      usageCount: 0,
    },
    {
      id: 'historical',
      label: 'Historical',
      description: 'Pre-1900',
      dimension: 'time',
      usageCount: 0,
    },
  ],
  // Entity dimensions - typically empty until user tags
  personality: [],
  matter: [],
  person: [],
  organization: [],
  event: [],
  work: [],
};

// =============================================================================
// API SEARCH FUNCTION
// =============================================================================

/**
 * Search for facet values via the node search API.
 */
async function searchFacetValues(
  query: string,
  dimension: FacetDimension
): Promise<FacetSuggestion[]> {
  if (query.length < 2) return [];

  const subkind = DIMENSION_SUBKINDS[dimension];

  try {
    // Build search parameters
    const params = new URLSearchParams({ query });
    if (subkind) {
      params.set('subkind', subkind);
      params.set('kind', 'type');
    } else {
      // For dimensions without subkind, search all objects
      params.set('kind', 'object');
    }
    params.set('status', 'established');
    params.set('limit', '20');

    const response = await fetch(`/xrpc/pub.chive.graph.searchNodes?${params.toString()}`);

    if (!response.ok) {
      console.debug('Facet search not available');
      return [];
    }

    const data = await response.json();
    return (data.nodes ?? []).map(
      (node: { id: string; uri: string; label: string; description?: string; slug?: string }) => ({
        id: node.slug ?? node.id,
        label: node.label,
        description: node.description ?? null,
        dimension,
        usageCount: 0,
      })
    );
  } catch (error) {
    console.debug('Facet search failed:', error);
    return [];
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Autocomplete input for facet values.
 *
 * @param props - Component props
 * @returns Facet autocomplete element
 */
export function FacetAutocomplete({
  dimension,
  value,
  onSelect,
  onClear,
  placeholder,
  disabled = false,
  className,
  id,
}: FacetAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<FacetSuggestion | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Search for facet values
  const { data: apiResults = [], isLoading } = useQuery({
    queryKey: ['facet-search', dimension, debouncedQuery],
    queryFn: () => searchFacetValues(debouncedQuery, dimension),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60 * 1000,
  });

  // Get fallback options for this dimension
  const fallbackOptions = useMemo(() => FALLBACK_OPTIONS[dimension] ?? [], [dimension]);

  // Combine API results with filtered fallbacks
  const suggestions = useMemo(() => {
    const lowerQuery = query.toLowerCase();

    // If we have API results, use them
    if (apiResults.length > 0) {
      return apiResults;
    }

    // Otherwise filter fallback options
    if (!query) {
      return fallbackOptions;
    }

    return fallbackOptions.filter(
      (s) => s.label.toLowerCase().includes(lowerQuery) || s.id.toLowerCase().includes(lowerQuery)
    );
  }, [apiResults, fallbackOptions, query]);

  // Update selected value when external value changes
  useEffect(() => {
    if (value) {
      // Try to find in fallbacks first
      const match = fallbackOptions.find((f) => f.id === value);
      if (match) {
        setSelectedValue(match);
      } else {
        // Create a placeholder for unknown values
        setSelectedValue({
          id: value,
          label: value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          description: null,
          dimension,
          usageCount: 0,
        });
      }
    } else {
      setSelectedValue(null);
    }
  }, [value, fallbackOptions, dimension]);

  const handleSelect = useCallback(
    (suggestion: FacetSuggestion) => {
      // Don't set selectedValue - let the parent manage selected state
      // This allows for multi-select scenarios where the parent displays selected items
      setQuery('');
      setIsOpen(false);
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
    }
  }, []);

  // Open popover when typing or focusing
  const handleFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
  }, []);

  const defaultPlaceholder = `Search ${DIMENSION_LABELS[dimension].toLowerCase()}...`;

  // Show selected value as badge
  if (selectedValue) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Badge variant="secondary" className="gap-1 py-1 pl-2 pr-1">
          <Layers className="h-3 w-3 text-muted-foreground" />
          <span>{selectedValue.label}</span>
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
            aria-label={`Search ${DIMENSION_LABELS[dimension]} values`}
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
        <Command>
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && suggestions.length === 0 && (
              <CommandEmpty className="py-3 text-center text-sm">
                No {DIMENSION_LABELS[dimension].toLowerCase()} values found
              </CommandEmpty>
            )}

            {suggestions.length > 0 && (
              <CommandGroup heading={`${DIMENSION_LABELS[dimension]} Values`}>
                {suggestions.slice(0, 10).map((suggestion) => (
                  <CommandItem
                    key={suggestion.id}
                    value={suggestion.id}
                    onSelect={() => handleSelect(suggestion)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span>{suggestion.label}</span>
                        </div>
                        {suggestion.description && (
                          <span className="text-xs text-muted-foreground ml-6 line-clamp-1">
                            {suggestion.description}
                          </span>
                        )}
                      </div>
                      {suggestion.usageCount > 0 && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {suggestion.usageCount.toLocaleString()} uses
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
