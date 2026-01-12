'use client';

/**
 * Funder autocomplete input using CrossRef Funder Registry.
 *
 * @remarks
 * Searches CrossRef Funder Registry API for funding organizations.
 * Returns funder name, DOI, and location for accurate attribution.
 *
 * @example
 * ```tsx
 * <FunderAutocomplete
 *   value={funderName}
 *   onSelect={(funder) => {
 *     form.setValue('funding.funderName', funder.name);
 *     form.setValue('funding.funderDoi', funder.doi);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useCallback } from 'react';
import { Building2, MapPin, ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { AutocompleteInput } from './autocomplete-input';

// =============================================================================
// TYPES
// =============================================================================

/**
 * CrossRef Funder result.
 */
export interface CrossRefFunder {
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
 * Props for FunderAutocomplete component.
 */
export interface FunderAutocompleteProps {
  /** Current funder name value */
  value?: string;
  /** Called when a funder is selected with full metadata */
  onSelect: (funder: CrossRefFunder) => void;
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
async function searchFunders(query: string): Promise<CrossRefFunder[]> {
  const params = new URLSearchParams({
    query,
    rows: '10',
    mailto: CROSSREF_POLITE_EMAIL,
  });

  const response = await fetch(`${CROSSREF_FUNDERS_URL}?${params.toString()}`);
  if (!response.ok) {
    console.error('CrossRef funders search failed:', response.statusText);
    return [];
  }

  const data: CrossRefFundersResponse = await response.json();
  return transformFundersResponse(data);
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Render a single funder result.
 */
function FunderResultItem({ funder }: { funder: CrossRefFunder }) {
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
 * Funder autocomplete input with CrossRef Funder Registry search.
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
  const renderItem = useCallback(
    (funder: CrossRefFunder) => <FunderResultItem funder={funder} />,
    []
  );

  const getItemKey = useCallback((funder: CrossRefFunder) => funder.doi, []);
  const getItemValue = useCallback((funder: CrossRefFunder) => funder.name, []);

  return (
    <AutocompleteInput<CrossRefFunder>
      id={id}
      placeholder={placeholder}
      groupLabel="Funding Organizations"
      queryFn={searchFunders}
      queryKeyPrefix="crossref-funder"
      onSelect={onSelect}
      onInputChange={onChange}
      onClear={onClear}
      renderItem={renderItem}
      getItemKey={getItemKey}
      getItemValue={getItemValue}
      initialValue={value}
      minChars={2}
      debounceMs={300}
      staleTime={60 * 1000}
      emptyMessage="No funders found. Try a different search term."
      disabled={disabled}
      className={className}
    />
  );
}
