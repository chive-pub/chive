'use client';

/**
 * Facet value autocomplete component.
 *
 * @remarks
 * Searches facet VALUES in the knowledge graph by querying the browseFaceted
 * endpoint, which resolves values via has-value edges from facet dimension nodes.
 *
 * Facet dimensions (like 'energy', 'space', 'time') have subkind='facet'.
 * Facet VALUES are linked to dimensions via has-value edges and may or may not
 * have their own subkind depending on the value type.
 *
 * @example
 * ```tsx
 * <FacetAutocomplete
 *   dimension="energy"
 *   value={parentFacetId}
 *   onSelect={(facet) => {
 *     setValue('parentFacetId', facet.id);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Layers, Search, Loader2, X, Check } from 'lucide-react';

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
import { useFacetCounts, type FacetDefinition } from '@/lib/hooks/use-faceted-search';
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
// DIMENSION LABELS
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

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Autocomplete input for facet values.
 *
 * @remarks
 * Uses the browseFaceted endpoint to get all facets and their values,
 * then filters client-side for the specific dimension and query.
 * This is efficient because facet data is cached and changes infrequently.
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

  // Fetch all facets with their values via browseFaceted
  // This uses has-value edges to resolve facet values from dimensions
  const { data: facets, isLoading } = useFacetCounts();

  // Find the facet definition for this dimension
  const facetDefinition = useMemo(() => {
    if (!facets) return null;
    return facets.find((f) => f.slug === dimension) ?? null;
  }, [facets, dimension]);

  // Convert facet values to suggestions and filter by query
  const filteredSuggestions = useMemo(() => {
    if (!facetDefinition) return [];

    const suggestions: FacetSuggestion[] = facetDefinition.values.map((v) => ({
      id: v.value,
      label: v.label ?? v.value,
      description: null,
      dimension,
      usageCount: v.count,
    }));

    // Filter by query (case-insensitive)
    if (!query) return suggestions;
    const lowerQuery = query.toLowerCase();
    return suggestions.filter(
      (s) => s.label.toLowerCase().includes(lowerQuery) || s.id.toLowerCase().includes(lowerQuery)
    );
  }, [facetDefinition, dimension, query]);

  // Update selected value when external value changes
  useEffect(() => {
    if (value && facetDefinition) {
      const match = facetDefinition.values.find((v) => v.value === value);
      if (match) {
        setSelectedValue({
          id: match.value,
          label: match.label ?? match.value,
          description: null,
          dimension,
          usageCount: match.count,
        });
      }
    } else {
      setSelectedValue(null);
    }
  }, [value, facetDefinition, dimension]);

  const handleSelect = useCallback(
    (suggestion: FacetSuggestion) => {
      setSelectedValue(suggestion);
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

  // Open popover when typing
  useEffect(() => {
    if (query.length >= 1) {
      setIsOpen(true);
    }
  }, [query]);

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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder ?? defaultPlaceholder}
            disabled={disabled || isLoading}
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

            {!isLoading && filteredSuggestions.length === 0 && (
              <CommandEmpty className="py-3 text-center text-sm">
                {facetDefinition
                  ? `No ${DIMENSION_LABELS[dimension].toLowerCase()} values found matching "${query}"`
                  : `No ${DIMENSION_LABELS[dimension].toLowerCase()} values available yet`}
              </CommandEmpty>
            )}

            {filteredSuggestions.length > 0 && (
              <CommandGroup heading={`${DIMENSION_LABELS[dimension]} Values`}>
                {filteredSuggestions.slice(0, 10).map((suggestion) => (
                  <CommandItem
                    key={suggestion.id}
                    value={suggestion.id}
                    onSelect={() => handleSelect(suggestion)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>{suggestion.label}</span>
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
