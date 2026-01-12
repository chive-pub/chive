'use client';

/**
 * DOI autocomplete input with CrossRef metadata auto-fill.
 *
 * @remarks
 * Searches CrossRef Works API for DOIs and publication metadata.
 * When a DOI is selected, automatically fills journal, publisher,
 * volume, issue, pages, and author information.
 *
 * @example
 * ```tsx
 * <DoiAutocomplete
 *   value={form.watch('publishedVersion.doi')}
 *   onSelect={(result) => {
 *     form.setValue('publishedVersion.doi', result.doi);
 *     form.setValue('publishedVersion.journal', result.journal);
 *     form.setValue('publishedVersion.publisher', result.publisher);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useCallback } from 'react';
import { ExternalLink, Calendar, BookOpen } from 'lucide-react';

import { cn } from '@/lib/utils';
import { AutocompleteInput } from './autocomplete-input';

// =============================================================================
// TYPES
// =============================================================================

/**
 * CrossRef work result.
 */
export interface CrossRefWork {
  /** DOI without https://doi.org/ prefix */
  doi: string;
  /** Work title */
  title: string;
  /** Publication year */
  year: number | null;
  /** Journal/container title */
  journal: string | null;
  /** Publisher name */
  publisher: string | null;
  /** Volume number */
  volume: string | null;
  /** Issue number */
  issue: string | null;
  /** Page range */
  pages: string | null;
  /** ISSN (print or electronic) */
  issn: string | null;
  /** Work type (journal-article, posted-content, etc.) */
  type: string;
  /** Author names */
  authors: Array<{
    given: string | null;
    family: string | null;
    orcid: string | null;
  }>;
  /** License URL if available */
  licenseUrl: string | null;
  /** URL to the work */
  url: string | null;
}

/**
 * CrossRef API response shape.
 */
interface CrossRefResponse {
  status: string;
  message: {
    items: Array<{
      DOI: string;
      title: string[];
      published?: {
        'date-parts': number[][];
      };
      'published-print'?: {
        'date-parts': number[][];
      };
      'published-online'?: {
        'date-parts': number[][];
      };
      'container-title': string[];
      publisher: string;
      volume?: string;
      issue?: string;
      page?: string;
      ISSN?: string[];
      type: string;
      author?: Array<{
        given?: string;
        family?: string;
        ORCID?: string;
      }>;
      license?: Array<{
        URL: string;
      }>;
      URL?: string;
    }>;
  };
}

/**
 * Props for DoiAutocomplete component.
 */
export interface DoiAutocompleteProps {
  /** Current DOI value */
  value?: string;
  /** Called when a DOI is selected with full metadata */
  onSelect: (work: CrossRefWork) => void;
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

const CROSSREF_API_URL = 'https://api.crossref.org/works';
const CROSSREF_POLITE_EMAIL = 'contact@chive.pub';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract year from CrossRef date-parts.
 */
function extractYear(work: CrossRefResponse['message']['items'][0]): number | null {
  const published = work.published ?? work['published-print'] ?? work['published-online'];
  if (published?.['date-parts']?.[0]?.[0]) {
    return published['date-parts'][0][0];
  }
  return null;
}

/**
 * Transform CrossRef API response to our work type.
 */
function transformCrossRefResponse(data: CrossRefResponse): CrossRefWork[] {
  return data.message.items.map((item) => ({
    doi: item.DOI,
    title: item.title?.[0] ?? 'Untitled',
    year: extractYear(item),
    journal: item['container-title']?.[0] ?? null,
    publisher: item.publisher,
    volume: item.volume ?? null,
    issue: item.issue ?? null,
    pages: item.page ?? null,
    issn: item.ISSN?.[0] ?? null,
    type: item.type,
    authors: (item.author ?? []).map((a) => ({
      given: a.given ?? null,
      family: a.family ?? null,
      orcid: a.ORCID?.replace('http://orcid.org/', '') ?? null,
    })),
    licenseUrl: item.license?.[0]?.URL ?? null,
    url: item.URL ?? null,
  }));
}

/**
 * Search CrossRef for works by query.
 */
async function searchCrossRef(query: string): Promise<CrossRefWork[]> {
  const params = new URLSearchParams({
    query,
    rows: '10',
    mailto: CROSSREF_POLITE_EMAIL,
  });

  const response = await fetch(`${CROSSREF_API_URL}?${params.toString()}`);
  if (!response.ok) {
    console.error('CrossRef search failed:', response.statusText);
    return [];
  }

  const data: CrossRefResponse = await response.json();
  return transformCrossRefResponse(data);
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Render a single CrossRef work result.
 */
function DoiResultItem({ work, isSelected }: { work: CrossRefWork; isSelected: boolean }) {
  const authorText =
    work.authors.length > 0
      ? work.authors
          .slice(0, 2)
          .map((a) => a.family ?? a.given)
          .filter(Boolean)
          .join(', ')
      : null;

  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium line-clamp-2">{work.title}</span>
        {work.year && <span className="shrink-0 text-xs text-muted-foreground">{work.year}</span>}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ExternalLink className="h-3 w-3 shrink-0" />
        <span className="font-mono">{work.doi}</span>
      </div>
      {(work.journal || authorText) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {work.journal && (
            <>
              <BookOpen className="h-3 w-3 shrink-0" />
              <span className="truncate">{work.journal}</span>
            </>
          )}
          {authorText && (
            <span className="truncate">
              {work.journal ? ' - ' : ''}
              {authorText}
              {work.authors.length > 2 && ' et al.'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * DOI autocomplete input with CrossRef search.
 *
 * @param props - Component props
 * @returns DOI autocomplete element
 */
export function DoiAutocomplete({
  value,
  onSelect,
  onChange,
  onClear,
  placeholder = 'Search by title or DOI...',
  disabled = false,
  className,
  id,
}: DoiAutocompleteProps) {
  const renderItem = useCallback(
    (work: CrossRefWork, isSelected: boolean) => (
      <DoiResultItem work={work} isSelected={isSelected} />
    ),
    []
  );

  const getItemKey = useCallback((work: CrossRefWork) => work.doi, []);
  const getItemValue = useCallback((work: CrossRefWork) => work.doi, []);

  return (
    <AutocompleteInput<CrossRefWork>
      id={id}
      placeholder={placeholder}
      groupLabel="Publications"
      queryFn={searchCrossRef}
      queryKeyPrefix="crossref-doi"
      onSelect={onSelect}
      onInputChange={onChange}
      onClear={onClear}
      renderItem={renderItem}
      getItemKey={getItemKey}
      getItemValue={getItemValue}
      initialValue={value}
      minChars={3}
      debounceMs={400}
      staleTime={60 * 1000}
      emptyMessage="No publications found. Try a different search term."
      disabled={disabled}
      className={className}
    />
  );
}

/**
 * Hook to extract publication metadata from a CrossRef work.
 *
 * @example
 * ```tsx
 * const extractMetadata = useExtractPublicationMetadata();
 *
 * const handleSelect = (work: CrossRefWork) => {
 *   const metadata = extractMetadata(work);
 *   form.setValue('publishedVersion', metadata);
 * };
 * ```
 */
export function useExtractPublicationMetadata() {
  return useCallback(
    (work: CrossRefWork) => ({
      doi: work.doi,
      url: work.url ?? `https://doi.org/${work.doi}`,
      journal: work.journal,
      publisher: work.publisher,
      volume: work.volume,
      issue: work.issue,
      pages: work.pages,
      issn: work.issn,
      year: work.year,
      licenseUrl: work.licenseUrl,
    }),
    []
  );
}
