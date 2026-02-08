'use client';

/**
 * Journal autocomplete input using CrossRef Journals API.
 *
 * @remarks
 * Searches CrossRef Journals API for academic journals.
 * Returns journal name, ISSN, and publisher information.
 *
 * @example
 * ```tsx
 * <JournalAutocomplete
 *   value={journal}
 *   onSelect={(journal) => {
 *     form.setValue('publishedVersion.journal', journal.title);
 *     form.setValue('publishedVersion.issn', journal.issn);
 *     form.setValue('publishedVersion.publisher', journal.publisher);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useCallback } from 'react';
import { Hash, Building2 } from 'lucide-react';

import { AutocompleteInput } from './autocomplete-input';
import { logger } from '@/lib/observability';

const journalLogger = logger.child({ component: 'journal-autocomplete' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * CrossRef Journal result.
 */
export interface CrossRefJournal {
  /** Journal ISSN (print or electronic) */
  issn: string;
  /** Journal title */
  title: string;
  /** Publisher name */
  publisher: string | null;
  /** All ISSNs associated with this journal */
  issns: string[];
  /** Subject areas */
  subjects: string[];
  /** Total articles indexed */
  totalDois: number | null;
}

/**
 * CrossRef Journals API response shape.
 */
interface CrossRefJournalsResponse {
  status: string;
  message: {
    items: Array<{
      ISSN: string[];
      title: string;
      publisher?: string;
      subjects?: Array<{ name: string }>;
      counts?: {
        'total-dois': number;
      };
    }>;
  };
}

/**
 * Props for JournalAutocomplete component.
 */
export interface JournalAutocompleteProps {
  /** Current journal name value */
  value?: string;
  /** Called when a journal is selected with full metadata */
  onSelect: (journal: CrossRefJournal) => void;
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

const CROSSREF_JOURNALS_URL = 'https://api.crossref.org/journals';
const CROSSREF_POLITE_EMAIL = 'contact@chive.pub';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Transform CrossRef Journals API response.
 */
function transformJournalsResponse(data: CrossRefJournalsResponse): CrossRefJournal[] {
  return data.message.items.map((item) => ({
    issn: item.ISSN[0] ?? '',
    title: item.title,
    publisher: item.publisher ?? null,
    issns: item.ISSN,
    subjects: item.subjects?.map((s) => s.name) ?? [],
    totalDois: item.counts?.['total-dois'] ?? null,
  }));
}

/**
 * Search CrossRef for journals by query.
 */
async function searchJournals(query: string): Promise<CrossRefJournal[]> {
  const params = new URLSearchParams({
    query,
    rows: '10',
    mailto: CROSSREF_POLITE_EMAIL,
  });

  const response = await fetch(`${CROSSREF_JOURNALS_URL}?${params.toString()}`);
  if (!response.ok) {
    journalLogger.error('CrossRef journals search failed', undefined, {
      status: response.status,
      statusText: response.statusText,
      query,
    });
    return [];
  }

  const data: CrossRefJournalsResponse = await response.json();
  return transformJournalsResponse(data);
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Render a single journal result.
 */
function JournalResultItem({ journal }: { journal: CrossRefJournal }) {
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium line-clamp-2">{journal.title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {journal.issn && (
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3 shrink-0" />
            ISSN: {journal.issn}
          </span>
        )}
        {journal.publisher && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3 shrink-0" />
            {journal.publisher}
          </span>
        )}
      </div>
      {journal.subjects.length > 0 && (
        <div className="text-xs text-muted-foreground truncate">
          {journal.subjects.slice(0, 3).join(', ')}
          {journal.subjects.length > 3 && '...'}
        </div>
      )}
    </div>
  );
}

/**
 * Journal autocomplete input with CrossRef Journals search.
 *
 * @param props - Component props
 * @returns Journal autocomplete element
 */
export function JournalAutocomplete({
  value,
  onSelect,
  onChange,
  onClear,
  placeholder = 'Search journals...',
  disabled = false,
  className,
  id,
}: JournalAutocompleteProps) {
  const renderItem = useCallback(
    (journal: CrossRefJournal) => <JournalResultItem journal={journal} />,
    []
  );

  const getItemKey = useCallback((journal: CrossRefJournal) => journal.issn, []);
  const getItemValue = useCallback((journal: CrossRefJournal) => journal.title, []);

  return (
    <AutocompleteInput<CrossRefJournal>
      id={id}
      placeholder={placeholder}
      groupLabel="Journals"
      queryFn={searchJournals}
      queryKeyPrefix="crossref-journal"
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
      emptyMessage="No journals found. Try a different search term."
      disabled={disabled}
      className={className}
    />
  );
}
