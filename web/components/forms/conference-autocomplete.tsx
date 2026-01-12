'use client';

/**
 * Conference autocomplete component.
 *
 * @remarks
 * Searches DBLP for academic conferences and venues.
 * Displays conference name, acronym, and type.
 *
 * @example
 * ```tsx
 * <ConferenceAutocomplete
 *   onSelect={(conference) => {
 *     form.setValue('conferencePresentation.conferenceName', conference.name);
 *     form.setValue('conferencePresentation.conferenceAcronym', conference.acronym);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import { Building } from 'lucide-react';

import { AutocompleteInput } from './autocomplete-input';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Conference/venue entry.
 */
export interface Conference {
  /** Venue ID from DBLP */
  id: string;
  /** Full conference name */
  name: string;
  /** Conference acronym (e.g., NeurIPS, ICML) */
  acronym: string | null;
  /** Conference URL */
  url: string | null;
  /** Conference type */
  type: 'conference' | 'journal' | 'workshop' | 'other';
}

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
function mapVenueType(type?: string): Conference['type'] {
  if (type === 'Conference or Workshop') return 'conference';
  if (type === 'Journal') return 'journal';
  if (type?.toLowerCase().includes('workshop')) return 'workshop';
  return 'other';
}

/**
 * Transform DBLP API response to our conference type.
 */
function transformDblpResponse(data: DblpVenueResponse): Conference[] {
  const hits = data.result.hits.hit ?? [];
  return hits.map((hit) => ({
    id: hit['@id'],
    name: hit.info.venue,
    acronym: hit.info.acronym ?? null,
    url: hit.info.url ?? null,
    type: mapVenueType(hit.info.type),
  }));
}

/**
 * Search DBLP venues.
 */
async function searchDblpVenues(query: string): Promise<Conference[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    h: '10',
  });

  const response = await fetch(`${DBLP_API_URL}?${params.toString()}`);

  if (!response.ok) {
    console.error('DBLP search failed:', response.statusText);
    return [];
  }

  const data: DblpVenueResponse = await response.json();
  return transformDblpResponse(data);
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Render a single conference result.
 */
function ConferenceResultItem({ conference }: { conference: Conference }) {
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
            <span className="px-1.5 py-0.5 rounded bg-muted capitalize">{conference.type}</span>
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
  placeholder = 'Search conferences...',
  disabled = false,
  className,
  id,
}: ConferenceAutocompleteProps) {
  const renderItem = useCallback(
    (conference: Conference) => <ConferenceResultItem conference={conference} />,
    []
  );

  const getItemKey = useCallback((conference: Conference) => conference.id, []);
  const getItemValue = useCallback(
    (conference: Conference) =>
      conference.acronym ? `${conference.name} (${conference.acronym})` : conference.name,
    []
  );

  return (
    <AutocompleteInput<Conference>
      id={id}
      placeholder={placeholder}
      groupLabel="Conferences"
      queryFn={searchDblpVenues}
      queryKeyPrefix="conference-search"
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
      emptyMessage="No conferences found."
      disabled={disabled}
      className={className}
    />
  );
}
