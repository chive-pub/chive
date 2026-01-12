'use client';

/**
 * ORCID autocomplete input component.
 *
 * @remarks
 * Searches ORCID public API for researchers by name.
 * Displays ORCID ID, name, and current affiliation.
 *
 * @example
 * ```tsx
 * <OrcidAutocomplete
 *   onSelect={(person) => {
 *     form.setValue('orcid', person.orcid);
 *     form.setValue('name', person.name);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import { User, Building } from 'lucide-react';

import { AutocompleteInput } from './autocomplete-input';

// =============================================================================
// TYPES
// =============================================================================

/**
 * ORCID person result.
 */
export interface OrcidPerson {
  /** ORCID identifier (e.g., 0000-0001-2345-6789) */
  orcid: string;
  /** Display name */
  name: string;
  /** Given name */
  givenName: string | null;
  /** Family name */
  familyName: string | null;
  /** Current affiliation */
  affiliation: string | null;
  /** Profile URL */
  url: string;
}

/**
 * ORCID API expanded search response.
 */
interface OrcidSearchResponse {
  'expanded-result': Array<{
    'orcid-id': string;
    'given-names': string | null;
    'family-names': string | null;
    'credit-name': string | null;
    'institution-name': string[] | null;
  }>;
}

/**
 * Props for OrcidAutocomplete component.
 */
export interface OrcidAutocompleteProps {
  /** Current ORCID value */
  value?: string;
  /** Called when a person is selected */
  onSelect: (person: OrcidPerson) => void;
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

const ORCID_API_URL = 'https://pub.orcid.org/v3.0/expanded-search';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Transform ORCID API response to our person type.
 */
function transformOrcidResponse(data: OrcidSearchResponse): OrcidPerson[] {
  const results = data['expanded-result'] ?? [];
  return results.map((item) => {
    const givenName = item['given-names'];
    const familyName = item['family-names'];
    const creditName = item['credit-name'];
    const name = creditName ?? ([givenName, familyName].filter(Boolean).join(' ') || 'Unknown');

    return {
      orcid: item['orcid-id'],
      name,
      givenName,
      familyName,
      affiliation: item['institution-name']?.[0] ?? null,
      url: `https://orcid.org/${item['orcid-id']}`,
    };
  });
}

/**
 * Search ORCID for people by name.
 */
async function searchOrcid(query: string): Promise<OrcidPerson[]> {
  const params = new URLSearchParams({
    q: query,
    rows: '10',
  });

  const response = await fetch(`${ORCID_API_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.error('ORCID search failed:', response.statusText);
    return [];
  }

  const data: OrcidSearchResponse = await response.json();
  return transformOrcidResponse(data);
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Render a single ORCID person result.
 */
function OrcidResultItem({ person }: { person: OrcidPerson }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 shrink-0 text-green-600" />
        <span className="text-sm font-medium">{person.name}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono text-green-600">{person.orcid}</span>
      </div>
      {person.affiliation && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Building className="h-3 w-3 shrink-0" />
          <span className="truncate">{person.affiliation}</span>
        </div>
      )}
    </div>
  );
}

/**
 * ORCID autocomplete input with public API search.
 *
 * @param props - Component props
 * @returns ORCID autocomplete element
 */
export function OrcidAutocomplete({
  value,
  onSelect,
  onChange,
  onClear,
  placeholder = 'Search by name...',
  disabled = false,
  className,
  id,
}: OrcidAutocompleteProps) {
  const renderItem = useCallback((person: OrcidPerson) => <OrcidResultItem person={person} />, []);

  const getItemKey = useCallback((person: OrcidPerson) => person.orcid, []);
  const getItemValue = useCallback((person: OrcidPerson) => `${person.name} (${person.orcid})`, []);

  return (
    <AutocompleteInput<OrcidPerson>
      id={id}
      placeholder={placeholder}
      groupLabel="Researchers"
      queryFn={searchOrcid}
      queryKeyPrefix="orcid-search"
      onSelect={onSelect}
      onInputChange={onChange}
      onClear={onClear}
      renderItem={renderItem}
      getItemKey={getItemKey}
      getItemValue={getItemValue}
      initialValue={value}
      minChars={2}
      debounceMs={400}
      staleTime={60 * 1000}
      emptyMessage="No researchers found. Try a different name."
      disabled={disabled}
      className={className}
    />
  );
}
