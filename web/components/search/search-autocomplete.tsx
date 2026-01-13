'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { Search, FileText, User, Tag, ArrowRight, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { EprintSummary, Author, FieldRef } from '@/lib/api/schema';

/**
 * Autocomplete suggestion types.
 */
export type SuggestionType = 'eprint' | 'author' | 'field' | 'keyword';

/**
 * A single autocomplete suggestion.
 */
export interface AutocompleteSuggestion {
  type: SuggestionType;
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

/**
 * Props for the SearchAutocomplete component.
 */
export interface SearchAutocompleteProps {
  /** Search query */
  query: string;
  /** Eprint suggestions */
  eprints?: EprintSummary[];
  /** Author suggestions */
  authors?: Author[];
  /** Field suggestions */
  fields?: FieldRef[];
  /** Keyword suggestions */
  keywords?: string[];
  /** Whether results are loading */
  isLoading?: boolean;
  /** Called when a suggestion is selected */
  onSelect?: (suggestion: AutocompleteSuggestion) => void;
  /** Called when "See all results" is clicked */
  onSeeAll?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Autocomplete dropdown with categorized suggestions.
 *
 * @remarks
 * Client component that displays search suggestions in categorized groups.
 * Supports keyboard navigation and click selection.
 *
 * @example
 * ```tsx
 * <SearchAutocomplete
 *   query={searchQuery}
 *   eprints={instantSearchResults.hits}
 *   isLoading={isSearching}
 *   onSelect={(s) => navigate(s.href)}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element with autocomplete dropdown
 */
export function SearchAutocomplete({
  query,
  eprints = [],
  authors = [],
  fields = [],
  keywords = [],
  isLoading = false,
  onSelect,
  onSeeAll,
  className,
}: SearchAutocompleteProps) {
  const hasResults =
    eprints.length > 0 || authors.length > 0 || fields.length > 0 || keywords.length > 0;

  if (!hasResults && !isLoading) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-lg',
        className
      )}
    >
      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {/* Eprint suggestions */}
          {eprints.length > 0 && (
            <SuggestionGroup title="Eprints" icon={<FileText className="h-4 w-4" />}>
              {eprints.slice(0, 3).map((eprint) => (
                <SuggestionItem
                  key={eprint.uri}
                  suggestion={{
                    type: 'eprint',
                    id: eprint.uri,
                    label: eprint.title,
                    sublabel: eprint.authors[0]?.name,
                    href: `/eprints/${encodeURIComponent(eprint.uri)}`,
                  }}
                  onSelect={onSelect}
                />
              ))}
            </SuggestionGroup>
          )}

          {/* Author suggestions */}
          {authors.length > 0 && (
            <SuggestionGroup title="Authors" icon={<User className="h-4 w-4" />}>
              {authors.slice(0, 3).map((author, index) => (
                <SuggestionItem
                  key={author.did ?? `author-${index}`}
                  suggestion={{
                    type: 'author',
                    id: author.did ?? '',
                    label: author.displayName ?? author.handle ?? author.did,
                    sublabel: author.handle,
                    href: author.did ? `/authors/${encodeURIComponent(author.did)}` : '#',
                  }}
                  onSelect={onSelect}
                />
              ))}
            </SuggestionGroup>
          )}

          {/* Field suggestions */}
          {fields.length > 0 && (
            <SuggestionGroup title="Fields" icon={<Tag className="h-4 w-4" />}>
              {fields.slice(0, 3).map((field) => {
                const fieldId = field.uri ?? field.id ?? '';
                return (
                  <SuggestionItem
                    key={fieldId}
                    suggestion={{
                      type: 'field',
                      id: fieldId,
                      label: field.name,
                      href: `/fields/${encodeURIComponent(fieldId)}`,
                    }}
                    onSelect={onSelect}
                  />
                );
              })}
            </SuggestionGroup>
          )}

          {/* Keyword suggestions */}
          {keywords.length > 0 && (
            <SuggestionGroup title="Keywords" icon={<Search className="h-4 w-4" />}>
              {keywords.slice(0, 5).map((keyword) => (
                <SuggestionItem
                  key={keyword}
                  suggestion={{
                    type: 'keyword',
                    id: keyword,
                    label: keyword,
                    href: `/search?q=${encodeURIComponent(keyword)}`,
                  }}
                  onSelect={onSelect}
                />
              ))}
            </SuggestionGroup>
          )}

          {/* See all results */}
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="flex w-full items-center justify-between border-t px-4 py-3 text-sm text-primary hover:bg-accent"
            >
              <span>See all results for &ldquo;{query}&rdquo;</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Props for the SuggestionGroup component.
 */
interface SuggestionGroupProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Group of suggestions with a title.
 */
function SuggestionGroup({ title, icon, children }: SuggestionGroupProps) {
  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * Props for the SuggestionItem component.
 */
interface SuggestionItemProps {
  suggestion: AutocompleteSuggestion;
  onSelect?: (suggestion: AutocompleteSuggestion) => void;
}

/**
 * Single suggestion item in the autocomplete list.
 */
function SuggestionItem({ suggestion, onSelect }: SuggestionItemProps) {
  const handleClick = useCallback(() => {
    onSelect?.(suggestion);
  }, [onSelect, suggestion]);

  return (
    <Link href={suggestion.href} onClick={handleClick} className="block px-4 py-2 hover:bg-accent">
      <div className="line-clamp-1 text-sm font-medium">{suggestion.label}</div>
      {suggestion.sublabel && (
        <div className="line-clamp-1 text-xs text-muted-foreground">{suggestion.sublabel}</div>
      )}
    </Link>
  );
}

/**
 * Props for the RecentSearches component.
 */
export interface RecentSearchesProps {
  /** Recent search queries */
  searches: string[];
  /** Called when a search is selected */
  onSelect: (query: string) => void;
  /** Called when a search should be removed */
  onRemove?: (query: string) => void;
  /** Called when all searches should be cleared */
  onClear?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays recent search history.
 *
 * @example
 * ```tsx
 * <RecentSearches
 *   searches={recentSearches}
 *   onSelect={(q) => performSearch(q)}
 *   onClear={() => clearHistory()}
 * />
 * ```
 */
export function RecentSearches({
  searches,
  onSelect,
  onRemove: _onRemove,
  onClear,
  className,
}: RecentSearchesProps) {
  if (searches.length === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium">Recent searches</h4>
        {onClear && (
          <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">
            Clear all
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {searches.map((search) => (
          <button
            key={search}
            onClick={() => onSelect(search)}
            className="group flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm hover:bg-accent"
          >
            <Search className="h-3 w-3 text-muted-foreground" />
            {search}
          </button>
        ))}
      </div>
    </div>
  );
}
