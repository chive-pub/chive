'use client';

/**
 * Eprint search autocomplete component.
 *
 * @remarks
 * Provides a unified search experience for finding eprints to claim.
 * Implements industry-standard UX patterns based on research from
 * Baymard Institute and Nielsen Norman Group:
 *
 * - Single input field (like Google Scholar) reduces cognitive load
 * - Max 8 suggestions prevents choice paralysis
 * - Visual source labels [arXiv], [LingBuzz] for recognition
 * - Inverted highlighting (bold untyped portion) for faster scanning
 * - Progressive disclosure for advanced options
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import * as React from 'react';
import { Search, Loader2, X, Star } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AutocompleteSuggestion, ImportSource } from '@/lib/hooks/use-eprint-search';

/**
 * Props for EprintSearchAutocomplete component.
 */
export interface EprintSearchAutocompleteProps {
  /** Current search query value */
  value: string;
  /** Handler for query changes */
  onChange: (value: string) => void;
  /** Handler for form submission */
  onSubmit?: (e: React.FormEvent) => void;
  /** Handler for suggestion selection */
  onSelectSuggestion?: (suggestion: AutocompleteSuggestion) => void;
  /** Autocomplete suggestions */
  suggestions: readonly AutocompleteSuggestion[];
  /** Whether autocomplete is loading */
  isLoading?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class names */
  className?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Auto focus on mount */
  autoFocus?: boolean;
}

/**
 * Get badge variant for source type.
 */
function getSourceVariant(source: ImportSource): 'default' | 'secondary' | 'outline' {
  switch (source) {
    case 'arxiv':
      return 'default';
    case 'openreview':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * Get display name for source.
 */
function getSourceDisplayName(source: ImportSource): string {
  const displayNames: Record<ImportSource, string> = {
    arxiv: 'arXiv',
    biorxiv: 'bioRxiv',
    medrxiv: 'medRxiv',
    psyarxiv: 'PsyArXiv',
    lingbuzz: 'LingBuzz',
    semanticsarchive: 'Semantics Archive',
    openreview: 'OpenReview',
    ssrn: 'SSRN',
    osf: 'OSF',
    zenodo: 'Zenodo',
    philpapers: 'PhilPapers',
    other: 'Other',
  };
  return displayNames[source] ?? source;
}

/**
 * Renders highlighted title with matched portions.
 *
 * @remarks
 * Uses "inverted highlighting" pattern - bolds the untyped portion
 * for faster scanning. This helps users quickly identify the
 * completion portion of the suggestion.
 */
function HighlightedTitle({
  title,
  highlightedTitle,
}: {
  title: string;
  highlightedTitle?: string;
}) {
  if (!highlightedTitle) {
    return <span>{title}</span>;
  }

  // The highlighted title contains ** markers for bold portions
  // Parse and render with proper styling
  const parts = highlightedTitle.split(/(\*\*[^*]+\*\*)/g);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // Bold portion (untyped text)
          return (
            <span key={i} className="font-semibold">
              {part.slice(2, -2)}
            </span>
          );
        }
        // Regular portion (matched text)
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

/**
 * Eprint search autocomplete input with suggestions dropdown.
 *
 * @remarks
 * Combines search input with autocomplete suggestions in a unified
 * component. Uses cmdk for keyboard navigation and accessibility.
 *
 * @example
 * ```tsx
 * const { query, setQuery, suggestions, isLoading, handleSelectSuggestion } =
 *   useEprintSearchState();
 *
 * return (
 *   <EprintSearchAutocomplete
 *     value={query}
 *     onChange={setQuery}
 *     suggestions={suggestions}
 *     isLoading={isLoading}
 *     onSelectSuggestion={handleSelectSuggestion}
 *   />
 * );
 * ```
 */
export function EprintSearchAutocomplete({
  value,
  onChange,
  onSubmit,
  onSelectSuggestion,
  suggestions,
  isLoading = false,
  placeholder = 'Search by title, author, or arXiv ID...',
  className,
  disabled = false,
  autoFocus = false,
}: EprintSearchAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Show dropdown when there are suggestions or loading
  const shouldShowDropdown = open && (suggestions.length > 0 || isLoading) && value.length >= 2;

  // Handle input change
  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);
      if (newValue.length >= 2) {
        setOpen(true);
      }
    },
    [onChange]
  );

  // Handle suggestion selection
  const handleSelect = React.useCallback(
    (suggestion: AutocompleteSuggestion) => {
      onSelectSuggestion?.(suggestion);
      setOpen(false);
    },
    [onSelectSuggestion]
  );

  // Handle clear button
  const handleClear = React.useCallback(() => {
    onChange('');
    setOpen(false);
    inputRef.current?.focus();
  }, [onChange]);

  // Handle form submission
  const handleFormSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setOpen(false);
      onSubmit?.(e);
    },
    [onSubmit]
  );

  // Handle keyboard navigation
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      } else if (e.key === 'ArrowDown' && !open && value.length >= 2) {
        setOpen(true);
      }
    },
    [open, value.length]
  );

  return (
    <form onSubmit={handleFormSubmit} className={cn('relative', className)}>
      <Popover open={shouldShowDropdown} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            {/* Search icon */}
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            {/* Input */}
            <Input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => value.length >= 2 && setOpen(true)}
              placeholder={placeholder}
              disabled={disabled}
              autoFocus={autoFocus}
              className="pl-9 pr-20"
              aria-label="Search eprints"
              aria-expanded={shouldShowDropdown}
              aria-controls="search-suggestions"
              aria-autocomplete="list"
              role="combobox"
            />

            {/* Loading indicator */}
            {isLoading && (
              <Loader2 className="absolute right-12 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}

            {/* Clear button */}
            {value.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent
          id="search-suggestions"
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {isLoading && suggestions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  <p className="mt-2">Searching external sources...</p>
                </div>
              ) : suggestions.length === 0 ? (
                <CommandEmpty>No eprints found matching &quot;{value}&quot;</CommandEmpty>
              ) : (
                <CommandGroup>
                  {suggestions.map((suggestion) => (
                    <CommandItem
                      key={`${suggestion.source}:${suggestion.externalId}`}
                      value={`${suggestion.source}:${suggestion.externalId}`}
                      onSelect={() => handleSelect(suggestion)}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <span className="text-sm font-medium line-clamp-2">
                          <HighlightedTitle
                            title={suggestion.title}
                            highlightedTitle={suggestion.highlightedTitle}
                          />
                        </span>
                        <Badge
                          variant={getSourceVariant(suggestion.source)}
                          className="shrink-0 text-xs"
                        >
                          {getSourceDisplayName(suggestion.source)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="line-clamp-1">{suggestion.authors}</span>
                        {suggestion.fieldMatchScore !== undefined &&
                          suggestion.fieldMatchScore > 0 && (
                            <span
                              className="flex items-center gap-0.5 text-yellow-600"
                              title="Matches your research fields"
                            >
                              <Star className="h-3 w-3" />
                              {Math.round(suggestion.fieldMatchScore * 100)}%
                            </span>
                          )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </form>
  );
}

export default EprintSearchAutocomplete;
