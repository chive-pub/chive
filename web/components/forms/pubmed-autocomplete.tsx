'use client';

/**
 * PubMed autocomplete input component.
 *
 * @remarks
 * Searches PubMed using NCBI E-Utilities API.
 * Displays PMID, title, journal, and authors.
 *
 * @example
 * ```tsx
 * <PubmedAutocomplete
 *   onSelect={(entry) => {
 *     form.setValue('externalIds.pmid', entry.pmid);
 *     form.setValue('title', entry.title);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import { FileText, BookOpen, Users, Calendar } from 'lucide-react';

import { logger } from '@/lib/observability';
import { AutocompleteInput } from './autocomplete-input';

const log = logger.child({ component: 'pubmed-autocomplete' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * PubMed entry result.
 */
export interface PubmedEntry {
  /** PubMed ID */
  pmid: string;
  /** PubMed Central ID (if available) */
  pmcid: string | null;
  /** Article title */
  title: string;
  /** Authors list */
  authors: string[];
  /** Journal name */
  journal: string | null;
  /** Publication date */
  pubDate: string | null;
  /** DOI (if available) */
  doi: string | null;
  /** URL to PubMed page */
  url: string;
}

/**
 * NCBI E-Search response.
 */
interface ESearchResponse {
  esearchresult: {
    idlist: string[];
  };
}

/**
 * NCBI E-Summary response.
 */
interface ESummaryResponse {
  result: {
    uids: string[];
    [pmid: string]:
      | {
          uid: string;
          title: string;
          authors?: Array<{ name: string }>;
          source?: string;
          pubdate?: string;
          articleids?: Array<{ idtype: string; value: string }>;
        }
      | string[];
  };
}

/**
 * Props for PubmedAutocomplete component.
 */
export interface PubmedAutocompleteProps {
  /** Current PMID value */
  value?: string;
  /** Called when an entry is selected */
  onSelect: (entry: PubmedEntry) => void;
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

const ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const ESUMMARY_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Search PubMed and fetch summaries.
 */
async function searchPubmed(query: string): Promise<PubmedEntry[]> {
  // Step 1: Search for IDs
  const searchParams = new URLSearchParams({
    db: 'pubmed',
    term: query,
    retmode: 'json',
    retmax: '10',
  });

  const searchResponse = await fetch(`${ESEARCH_URL}?${searchParams.toString()}`);
  if (!searchResponse.ok) {
    log.error('PubMed search failed', undefined, {
      query,
      status: searchResponse.status,
      statusText: searchResponse.statusText,
    });
    return [];
  }

  const searchData: ESearchResponse = await searchResponse.json();
  const ids = searchData.esearchresult.idlist;

  if (ids.length === 0) {
    return [];
  }

  // Step 2: Fetch summaries for found IDs
  const summaryParams = new URLSearchParams({
    db: 'pubmed',
    id: ids.join(','),
    retmode: 'json',
  });

  const summaryResponse = await fetch(`${ESUMMARY_URL}?${summaryParams.toString()}`);
  if (!summaryResponse.ok) {
    log.error('PubMed summary fetch failed', undefined, {
      pmids: ids,
      status: summaryResponse.status,
      statusText: summaryResponse.statusText,
    });
    return [];
  }

  const summaryData: ESummaryResponse = await summaryResponse.json();
  const results: PubmedEntry[] = [];

  for (const pmid of ids) {
    const record = summaryData.result[pmid];
    if (!record || Array.isArray(record)) continue;

    // Extract DOI and PMCID from article IDs
    let doi: string | null = null;
    let pmcid: string | null = null;
    for (const articleId of record.articleids ?? []) {
      if (articleId.idtype === 'doi') doi = articleId.value;
      if (articleId.idtype === 'pmc') pmcid = articleId.value;
    }

    results.push({
      pmid,
      pmcid,
      title: record.title ?? 'Untitled',
      authors: (record.authors ?? []).map((a) => a.name),
      journal: record.source ?? null,
      pubDate: record.pubdate ?? null,
      doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    });
  }

  return results;
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Render a single PubMed entry result.
 */
function PubmedResultItem({ entry }: { entry: PubmedEntry }) {
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
        <FileText className="h-3 w-3 shrink-0 text-blue-600" />
        <span className="font-mono text-blue-600">PMID: {entry.pmid}</span>
        {entry.pmcid && (
          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">PMC</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {entry.journal && (
          <>
            <BookOpen className="h-3 w-3 shrink-0" />
            <span className="truncate">{entry.journal}</span>
          </>
        )}
        {authorText && (
          <>
            <Users className="h-3 w-3 shrink-0 ml-2" />
            <span className="truncate">{authorText}</span>
          </>
        )}
      </div>
      {entry.pubDate && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>{entry.pubDate}</span>
        </div>
      )}
    </div>
  );
}

/**
 * PubMed autocomplete input with NCBI E-Utilities search.
 *
 * @param props - Component props
 * @returns PubMed autocomplete element
 */
export function PubmedAutocomplete({
  value,
  onSelect,
  onChange,
  onClear,
  placeholder = 'Search PubMed by title or PMID...',
  disabled = false,
  className,
  id,
}: PubmedAutocompleteProps) {
  const renderItem = useCallback((entry: PubmedEntry) => <PubmedResultItem entry={entry} />, []);

  const getItemKey = useCallback((entry: PubmedEntry) => entry.pmid, []);
  const getItemValue = useCallback((entry: PubmedEntry) => entry.pmid, []);

  return (
    <AutocompleteInput<PubmedEntry>
      id={id}
      placeholder={placeholder}
      groupLabel="PubMed Articles"
      queryFn={searchPubmed}
      queryKeyPrefix="pubmed-search"
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
      emptyMessage="No PubMed articles found."
      disabled={disabled}
      className={className}
    />
  );
}
