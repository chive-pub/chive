'use client';

/**
 * Keyword autocomplete input component.
 *
 * @remarks
 * Provides research keyword input with Wikidata and FAST autocomplete.
 * Selected keywords include authority IDs for semantic linking.
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useMemo } from 'react';
import { Plus, X, Loader2, Tag, ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useKeywordAutocomplete,
  type KeywordSuggestion,
} from '@/lib/hooks/use-profile-autocomplete';
import type { ResearchKeyword } from '@/lib/api/schema';

export interface KeywordAutocompleteInputProps {
  /** Label for the input */
  label: string;
  /** Current keywords */
  values: ResearchKeyword[];
  /** Handler for value changes */
  onChange: (values: ResearchKeyword[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum number of items */
  maxItems?: number;
  /** Description text */
  description?: string;
  /** Additional class name */
  className?: string;
}

/**
 * Get URL for keyword authority.
 */
function getAuthorityUrl(keyword: ResearchKeyword): string | null {
  if (keyword.wikidataId) {
    return `https://www.wikidata.org/wiki/${keyword.wikidataId}`;
  }
  if (keyword.fastId) {
    return `https://id.worldcat.org/fast/${keyword.fastId}`;
  }
  return null;
}

/**
 * Get authority badge label.
 */
function getAuthorityLabel(keyword: ResearchKeyword): string | null {
  if (keyword.wikidataId) return 'WD';
  if (keyword.fastId) return 'FAST';
  return null;
}

/**
 * Keyword autocomplete input with Wikidata and FAST integration.
 */
export function KeywordAutocompleteInput({
  label,
  values,
  onChange,
  placeholder = 'Search keywords...',
  maxItems,
  description,
  className,
}: KeywordAutocompleteInputProps) {
  const [inputValue, setInputValue] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { data, isLoading } = useKeywordAutocomplete(inputValue, {
    enabled: inputValue.length >= 2,
  });

  const suggestions = useMemo(() => data?.suggestions ?? [], [data?.suggestions]);

  // Separate suggestions by source (Wikidata first, then FAST)
  const wikidataSuggestions = useMemo(
    () => suggestions.filter((s) => s.source === 'wikidata'),
    [suggestions]
  );
  const fastSuggestions = useMemo(
    () => suggestions.filter((s) => s.source === 'fast'),
    [suggestions]
  );

  const shouldShowDropdown = open && inputValue.length >= 2;
  const hasAnySuggestions = wikidataSuggestions.length > 0 || fastSuggestions.length > 0;

  const handleSelect = React.useCallback(
    (suggestion: KeywordSuggestion) => {
      // Check for duplicates
      if (
        values.some(
          (v) =>
            v.label.toLowerCase() === suggestion.label.toLowerCase() ||
            (v.fastId && v.fastId === suggestion.id) ||
            (v.wikidataId && v.wikidataId === suggestion.id)
        )
      ) {
        return;
      }

      // Check max items
      if (maxItems && values.length >= maxItems) {
        return;
      }

      const newKeyword: ResearchKeyword = {
        label: suggestion.label,
        ...(suggestion.source === 'fast' && { fastId: suggestion.id }),
        ...(suggestion.source === 'wikidata' && { wikidataId: suggestion.id }),
      };

      onChange([...values, newKeyword]);
      setInputValue('');
      setOpen(false);
      inputRef.current?.focus();
    },
    [values, onChange, maxItems]
  );

  const handleAddFreeText = React.useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // Check for duplicates
    if (values.some((v) => v.label.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    // Check max items
    if (maxItems && values.length >= maxItems) {
      return;
    }

    onChange([...values, { label: trimmed }]);
    setInputValue('');
    setOpen(false);
  }, [inputValue, values, onChange, maxItems]);

  const handleRemove = React.useCallback(
    (index: number) => {
      onChange(values.filter((_, i) => i !== index));
    },
    [values, onChange]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Prefer Wikidata over FAST when pressing Enter
        if (wikidataSuggestions.length > 0) {
          handleSelect(wikidataSuggestions[0]);
        } else if (fastSuggestions.length > 0) {
          handleSelect(fastSuggestions[0]);
        } else if (inputValue.trim()) {
          handleAddFreeText();
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [wikidataSuggestions, fastSuggestions, handleSelect, inputValue, handleAddFreeText]
  );

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}

      <Popover open={shouldShowDropdown} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (e.target.value.length >= 2) {
                    setOpen(true);
                  }
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => inputValue.length >= 2 && setOpen(true)}
                placeholder={placeholder}
                className="pl-9"
                disabled={maxItems !== undefined && values.length >= maxItems}
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddFreeText}
              disabled={!inputValue.trim() || (maxItems !== undefined && values.length >= maxItems)}
              title="Add as free text"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {isLoading && !hasAnySuggestions ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  <p className="mt-2">Searching Wikidata &amp; FAST...</p>
                </div>
              ) : !hasAnySuggestions ? (
                <CommandEmpty>
                  <div className="text-center">
                    <p>No keywords found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Press Enter to add &quot;{inputValue}&quot; as free text
                    </p>
                  </div>
                </CommandEmpty>
              ) : (
                <>
                  {/* Wikidata Concepts (first) */}
                  {wikidataSuggestions.length > 0 && (
                    <CommandGroup heading="Wikidata Concepts">
                      {wikidataSuggestions.map((suggestion, index) => (
                        <CommandItem
                          key={`wikidata-${suggestion.id}-${index}`}
                          value={`wikidata-${suggestion.id}`}
                          onSelect={() => handleSelect(suggestion)}
                          className="flex flex-col items-start gap-1 py-3"
                        >
                          <div className="flex w-full items-start justify-between gap-2">
                            <span className="text-sm font-medium">{suggestion.label}</span>
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              Wikidata
                            </Badge>
                          </div>
                          {suggestion.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {suggestion.description}
                            </p>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {/* FAST Subject Headings (second) */}
                  {fastSuggestions.length > 0 && (
                    <CommandGroup heading="FAST Subject Headings">
                      {fastSuggestions.map((suggestion, index) => (
                        <CommandItem
                          key={`fast-${suggestion.id}-${index}`}
                          value={`fast-${suggestion.id}`}
                          onSelect={() => handleSelect(suggestion)}
                          className="flex flex-col items-start gap-1 py-3"
                        >
                          <div className="flex w-full items-start justify-between gap-2">
                            <span className="text-sm font-medium">{suggestion.label}</span>
                            <Badge variant="default" className="shrink-0 text-xs">
                              FAST
                            </Badge>
                          </div>
                          {suggestion.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {suggestion.description}
                            </p>
                          )}
                          {suggestion.usageCount !== null && suggestion.usageCount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Used in {suggestion.usageCount.toLocaleString()} records
                            </p>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected keywords */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {values.map((keyword, index) => {
            const authorityUrl = getAuthorityUrl(keyword);
            const authorityLabel = getAuthorityLabel(keyword);

            return (
              <Badge key={index} variant="secondary" className="gap-1 py-1 px-2">
                {keyword.label}
                {authorityLabel && (
                  <span className="text-xs text-muted-foreground ml-1">({authorityLabel})</span>
                )}
                {authorityUrl && (
                  <a
                    href={authorityUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                    title={`View on ${authorityLabel}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {maxItems && (
        <p className="text-xs text-muted-foreground">
          {values.length}/{maxItems} items
        </p>
      )}
    </div>
  );
}
