'use client';

/**
 * Facet value autocomplete component.
 *
 * @remarks
 * Searches existing facet values in the knowledge graph.
 * Used in governance proposals for selecting parent facet values
 * and linking related facets.
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
import { useCallback } from 'react';
import { Layers, ExternalLink } from 'lucide-react';

import { AutocompleteInput } from './autocomplete-input';
import type { FacetDimension } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Facet value suggestion.
 */
export interface FacetSuggestion {
  /** Facet value ID */
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
  /** Filter to specific dimension (optional) */
  dimension?: FacetDimension;
  /** Current selected facet ID */
  value?: string;
  /** Called when a facet is selected */
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
// API
// =============================================================================

/**
 * Search facets using unified node API.
 *
 * @remarks
 * In the unified model, facets are nodes with subkind=facet.
 * The dimension parameter is preserved for backwards compatibility
 * but facets no longer have PMEST/FAST distinction in the unified model.
 *
 * @param query - Search query
 * @param _dimension - Deprecated, kept for API compatibility
 * @returns Array of facet suggestions
 */
async function searchFacets(
  query: string,
  _dimension?: FacetDimension
): Promise<FacetSuggestion[]> {
  if (query.length < 2) return [];

  try {
    // Build URL with parameters - use unified node search
    const params = new URLSearchParams({
      query,
      subkind: 'facet',
      kind: 'type',
    });

    const url = `/xrpc/pub.chive.graph.searchNodes?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      // API may not exist yet - return empty
      console.debug('Node search not available yet');
      return [];
    }

    const data = await response.json();
    // Map unified node response to FacetSuggestion format
    return (data.nodes ?? []).map(
      (node: { id: string; label: string; description?: string; status: string }) => ({
        id: node.id,
        label: node.label,
        description: node.description ?? null,
        // In unified model, facets don't have dimension - default to 'matter'
        dimension: 'matter' as FacetDimension,
        usageCount: 0,
      })
    ) as FacetSuggestion[];
  } catch (error) {
    // API not implemented yet
    console.debug('Node search failed:', error);
    return [];
  }
}

// =============================================================================
// DIMENSION LABELS
// =============================================================================

const DIMENSION_LABELS: Record<FacetDimension, string> = {
  personality: 'Personality',
  matter: 'Matter',
  energy: 'Energy',
  space: 'Space',
  time: 'Time',
  person: 'Person',
  organization: 'Organization',
  event: 'Event',
  work: 'Work',
  'form-genre': 'Form/Genre',
};

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
  // Create search function with dimension filter
  const searchFn = useCallback((query: string) => searchFacets(query, dimension), [dimension]);

  // Generate placeholder based on dimension
  const defaultPlaceholder = dimension
    ? `Search ${DIMENSION_LABELS[dimension]} facets...`
    : 'Search facets...';

  const renderItem = useCallback(
    (item: FacetSuggestion, isSelected: boolean) => (
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={isSelected ? 'font-medium' : ''}>{item.label}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              ({DIMENSION_LABELS[item.dimension]})
            </span>
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-1 ml-6">
              {item.description}
            </p>
          )}
        </div>
        {item.usageCount > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">
            {item.usageCount.toLocaleString()} uses
          </span>
        )}
      </div>
    ),
    []
  );

  return (
    <AutocompleteInput<FacetSuggestion>
      id={id}
      placeholder={placeholder ?? defaultPlaceholder}
      groupLabel={dimension ? `${DIMENSION_LABELS[dimension]} Facets` : 'Facet Values'}
      queryFn={searchFn}
      queryKeyPrefix={`facet-search-${dimension ?? 'all'}`}
      onSelect={onSelect}
      onClear={onClear}
      renderItem={renderItem}
      getItemKey={(item) => item.id}
      getItemValue={(item) => item.label}
      initialValue=""
      minChars={2}
      debounceMs={300}
      staleTime={30 * 1000}
      emptyMessage={
        dimension
          ? `No ${DIMENSION_LABELS[dimension].toLowerCase()} facets found. Facets will appear after seeding.`
          : 'No facets found. Facets will appear after seeding.'
      }
      disabled={disabled}
      clearable
      className={className}
    />
  );
}
