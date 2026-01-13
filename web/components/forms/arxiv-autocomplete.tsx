'use client';

/**
 * arXiv autocomplete input component.
 *
 * @remarks
 * Searches arXiv API for eprints by title or ID.
 * Displays arXiv ID, title, and authors.
 *
 * @example
 * ```tsx
 * <ArxivAutocomplete
 *   onSelect={(entry) => {
 *     form.setValue('externalIds.arxivId', entry.id);
 *     form.setValue('title', entry.title);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import { FileText, Calendar, Users } from 'lucide-react';

import { AutocompleteInput } from './autocomplete-input';

// =============================================================================
// TYPES
// =============================================================================

/**
 * arXiv entry result.
 */
export interface ArxivEntry {
  /** arXiv identifier (e.g., 2401.12345) */
  id: string;
  /** Paper title */
  title: string;
  /** Abstract (truncated) */
  abstract: string | null;
  /** Author names */
  authors: string[];
  /** Primary category (e.g., cs.AI) */
  category: string | null;
  /** Publication date */
  published: string | null;
  /** Last updated date */
  updated: string | null;
  /** URL to arXiv page */
  url: string;
  /** PDF URL */
  pdfUrl: string;
}

/**
 * Props for ArxivAutocomplete component.
 */
export interface ArxivAutocompleteProps {
  /** Current arXiv ID value */
  value?: string;
  /** Called when an entry is selected */
  onSelect: (entry: ArxivEntry) => void;
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

const ARXIV_API_URL = 'https://export.arxiv.org/api/query';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract text content from an XML element.
 */
function getTextContent(element: Element, tagName: string): string | null {
  const el = element.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() ?? null;
}

/**
 * Extract arXiv ID from full URL or ID string.
 */
function extractArxivId(idOrUrl: string): string {
  // Handle full URLs like http://arxiv.org/abs/2401.12345v1
  const match = idOrUrl.match(/(?:arxiv\.org\/abs\/)?(\d{4}\.\d{4,5}(?:v\d+)?)/i);
  if (match) {
    // Remove version suffix for cleaner display
    return match[1].replace(/v\d+$/, '');
  }
  return idOrUrl;
}

/**
 * Parse arXiv Atom XML response.
 */
function parseArxivResponse(xmlText: string): ArxivEntry[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const entries = doc.getElementsByTagName('entry');
  const results: ArxivEntry[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;

    const idRaw = getTextContent(entry, 'id') ?? '';
    const id = extractArxivId(idRaw);

    // Skip malformed entries
    if (!id || id.length < 5) continue;

    const title = getTextContent(entry, 'title')?.replace(/\s+/g, ' ') ?? 'Untitled';
    const abstract = getTextContent(entry, 'summary')?.slice(0, 300) ?? null;

    // Extract authors
    const authorEls = entry.getElementsByTagName('author');
    const authors: string[] = [];
    for (let j = 0; j < authorEls.length; j++) {
      const name = authorEls[j]?.getElementsByTagName('name')[0]?.textContent;
      if (name) authors.push(name);
    }

    // Extract primary category
    const categoryEl = entry.getElementsByTagName('arxiv:primary_category')[0];
    const category = categoryEl?.getAttribute('term') ?? null;

    const published = getTextContent(entry, 'published')?.slice(0, 10) ?? null;
    const updated = getTextContent(entry, 'updated')?.slice(0, 10) ?? null;

    results.push({
      id,
      title,
      abstract,
      authors,
      category,
      published,
      updated,
      url: `https://arxiv.org/abs/${id}`,
      pdfUrl: `https://arxiv.org/pdf/${id}.pdf`,
    });
  }

  return results;
}

/**
 * Search arXiv for papers by query.
 */
async function searchArxiv(query: string): Promise<ArxivEntry[]> {
  // Check if query looks like an arXiv ID
  const isIdQuery = /^\d{4}\.\d{4,5}/.test(query);

  const params = new URLSearchParams({
    search_query: isIdQuery ? `id:${query}` : `all:${query}`,
    start: '0',
    max_results: '10',
    sortBy: 'relevance',
    sortOrder: 'descending',
  });

  const response = await fetch(`${ARXIV_API_URL}?${params.toString()}`);

  if (!response.ok) {
    console.error('arXiv search failed:', response.statusText);
    return [];
  }

  const xmlText = await response.text();
  return parseArxivResponse(xmlText);
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Render a single arXiv entry result.
 */
function ArxivResultItem({ entry }: { entry: ArxivEntry }) {
  const authorText =
    entry.authors.length > 0
      ? entry.authors.slice(0, 2).join(', ') + (entry.authors.length > 2 ? ' et al.' : '')
      : null;

  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium line-clamp-2">{entry.title}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-3 w-3 shrink-0 text-red-600" />
        <span className="font-mono text-red-600">arXiv:{entry.id}</span>
        {entry.category && (
          <span className="px-1.5 py-0.5 bg-muted rounded text-xs">{entry.category}</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {authorText && (
          <>
            <Users className="h-3 w-3 shrink-0" />
            <span className="truncate">{authorText}</span>
          </>
        )}
        {entry.published && (
          <>
            <Calendar className="h-3 w-3 shrink-0 ml-2" />
            <span>{entry.published}</span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * arXiv autocomplete input with API search.
 *
 * @param props - Component props
 * @returns arXiv autocomplete element
 */
export function ArxivAutocomplete({
  value,
  onSelect,
  onChange,
  onClear,
  placeholder = 'Search by title or arXiv ID...',
  disabled = false,
  className,
  id,
}: ArxivAutocompleteProps) {
  const renderItem = useCallback((entry: ArxivEntry) => <ArxivResultItem entry={entry} />, []);

  const getItemKey = useCallback((entry: ArxivEntry) => entry.id, []);
  const getItemValue = useCallback((entry: ArxivEntry) => entry.id, []);

  return (
    <AutocompleteInput<ArxivEntry>
      id={id}
      placeholder={placeholder}
      groupLabel="arXiv Eprints"
      queryFn={searchArxiv}
      queryKeyPrefix="arxiv-search"
      onSelect={onSelect}
      onInputChange={onChange}
      onClear={onClear}
      renderItem={renderItem}
      getItemKey={getItemKey}
      getItemValue={getItemValue}
      initialValue={value}
      minChars={3}
      debounceMs={500}
      staleTime={60 * 1000}
      emptyMessage="No arXiv eprints found."
      disabled={disabled}
      className={className}
    />
  );
}
