'use client';

/**
 * Library of Congress Subject Headings (LCSH) autocomplete component.
 *
 * @remarks
 * Searches the Library of Congress suggest API for subject headings.
 * Used in governance proposals for linking facet values to LCSH.
 *
 * @example
 * ```tsx
 * <LcshAutocomplete
 *   value={lcshUri}
 *   onSelect={(suggestion) => {
 *     setValue('lcshUri', suggestion.uri);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useCallback } from 'react';
import { ExternalLink } from 'lucide-react';

import { AutocompleteInput } from './autocomplete-input';

// =============================================================================
// TYPES
// =============================================================================

/**
 * LCSH suggestion from Library of Congress API.
 */
export interface LcshSuggestion {
  /** LCSH identifier (e.g., "sh85079604") */
  id: string;
  /** Display label */
  label: string;
  /** Full URI */
  uri: string;
}

/**
 * Props for LcshAutocomplete component.
 */
export interface LcshAutocompleteProps {
  /** Current selected URI value */
  value?: string;
  /** Called when a subject heading is selected */
  onSelect: (suggestion: LcshSuggestion) => void;
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
 * Search Library of Congress Subject Headings.
 *
 * @remarks
 * Uses the LOC suggest2 API which returns results in OpenSearch format.
 * API documentation: https://id.loc.gov/techcenter/searching.html
 *
 * @param query - Search query
 * @returns Array of LCSH suggestions
 */
async function searchLcsh(query: string): Promise<LcshSuggestion[]> {
  if (query.length < 2) return [];

  const url = `https://id.loc.gov/authorities/subjects/suggest2?q=${encodeURIComponent(query)}`;

  const response = await fetch(url);
  if (!response.ok) {
    console.error('LCSH search failed:', response.statusText);
    return [];
  }

  // Response format: [query, [labels], [descriptions], [uris]]
  const data = await response.json();

  if (!Array.isArray(data) || data.length < 4) {
    return [];
  }

  const [, labels, , uris] = data as [string, string[], string[], string[]];

  return labels.map((label, i) => {
    const uri = uris[i] ?? '';
    // Extract LCSH ID from URI (e.g., "http://id.loc.gov/authorities/subjects/sh85079604" -> "sh85079604")
    const id = uri.split('/').pop() ?? '';

    return {
      id,
      label,
      uri,
    };
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Autocomplete input for Library of Congress Subject Headings.
 *
 * @param props - Component props
 * @returns LCSH autocomplete element
 */
export function LcshAutocomplete({
  value,
  onSelect,
  onClear,
  placeholder = 'Search LCSH...',
  disabled = false,
  className,
  id,
}: LcshAutocompleteProps) {
  // Extract initial display value from URI if present
  const initialValue = value ? extractLcshId(value) : '';

  const handleSelect = useCallback(
    (suggestion: LcshSuggestion) => {
      onSelect(suggestion);
    },
    [onSelect]
  );

  const renderItem = useCallback(
    (item: LcshSuggestion, isSelected: boolean) => (
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={isSelected ? 'font-medium' : ''}>{item.label}</span>
            <span className="text-xs text-muted-foreground shrink-0">{item.id}</span>
          </div>
        </div>
        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
      </div>
    ),
    []
  );

  return (
    <AutocompleteInput<LcshSuggestion>
      id={id}
      placeholder={placeholder}
      groupLabel="LCSH Subject Headings"
      queryFn={searchLcsh}
      queryKeyPrefix="lcsh-search"
      onSelect={handleSelect}
      onClear={onClear}
      renderItem={renderItem}
      getItemKey={(item) => item.id}
      getItemValue={(item) => item.label}
      initialValue={initialValue}
      minChars={2}
      debounceMs={300}
      staleTime={5 * 60 * 1000} // 5 minutes
      emptyMessage="No LCSH headings found."
      disabled={disabled}
      clearable
      className={className}
    />
  );
}

/**
 * Extract LCSH ID from URI.
 *
 * @param uri - Full LCSH URI
 * @returns LCSH ID (e.g., "sh85079604")
 */
function extractLcshId(uri: string): string {
  if (!uri) return '';
  const parts = uri.split('/');
  return parts[parts.length - 1] ?? '';
}
