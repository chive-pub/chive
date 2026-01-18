'use client';

/**
 * FAST (Faceted Application of Subject Terminology) autocomplete component.
 *
 * @remarks
 * Wrapper around the existing keyword autocomplete that filters to FAST only.
 * Used in governance proposals for linking facet values to FAST subject headings.
 *
 * @see {@link https://www.oclc.org/research/areas/data-science/fast.html | FAST}
 *
 * @example
 * ```tsx
 * <FastAutocomplete
 *   value={fastUri}
 *   onSelect={(suggestion) => {
 *     setValue('fastUri', suggestion.uri);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Loader2, ExternalLink, X, Tag } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  useKeywordAutocomplete,
  type KeywordSuggestion,
} from '@/lib/hooks/use-profile-autocomplete';

// =============================================================================
// TYPES
// =============================================================================

/**
 * FAST suggestion with full URI.
 */
export interface FastSuggestion {
  /** FAST identifier (numeric) */
  fastId: string;
  /** Display label */
  label: string;
  /** Description/scope note */
  description: string | null;
  /** Usage count in WorldCat */
  usageCount: number | null;
  /** Full FAST URI */
  uri: string;
}

/**
 * Props for FastAutocomplete component.
 */
export interface FastAutocompleteProps {
  /** Current selected FAST URI */
  value?: string;
  /** Called when a FAST heading is selected */
  onSelect: (suggestion: FastSuggestion) => void;
  /** Called when selection is cleared */
  onClear?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Input ID for accessibility */
  id?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Autocomplete input for FAST subject headings.
 *
 * @remarks
 * Uses the existing keyword autocomplete hook with FAST-only filtering.
 * FAST IDs are numeric and correspond to WorldCat FAST URIs.
 *
 * @param props - Component props
 * @returns FAST autocomplete element
 */
export function FastAutocomplete({
  value,
  onSelect,
  onClear,
  placeholder = 'Search FAST headings...',
  disabled = false,
  className,
  id,
}: FastAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use existing keyword autocomplete hook with FAST-only filter
  const { data, isLoading } = useKeywordAutocomplete(inputValue, {
    enabled: inputValue.length >= 2,
    sources: ['fast'],
  });

  const suggestions = useMemo(() => data?.suggestions ?? [], [data?.suggestions]);
  const shouldShowDropdown = open && inputValue.length >= 2;

  // Parse initial value from URI to show in input
  useEffect(() => {
    if (value) {
      const fastId = extractFastId(value);
      if (fastId && !inputValue) {
        // We have a value but no input - show the ID as placeholder
        // The actual label would require an API call, so we just show ID
        setInputValue('');
      }
    }
  }, [value, inputValue]);

  const handleSelect = useCallback(
    (suggestion: KeywordSuggestion) => {
      const fastSuggestion: FastSuggestion = {
        fastId: suggestion.id,
        label: suggestion.label,
        description: suggestion.description,
        usageCount: suggestion.usageCount,
        uri: `https://id.worldcat.org/fast/${suggestion.id}`,
      };

      onSelect(fastSuggestion);
      setInputValue(suggestion.label);
      setOpen(false);
    },
    [onSelect]
  );

  const handleClear = useCallback(() => {
    setInputValue('');
    onClear?.();
    inputRef.current?.focus();
  }, [onClear]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      } else if (e.key === 'Enter' && suggestions.length > 0) {
        e.preventDefault();
        handleSelect(suggestions[0]);
      }
    },
    [suggestions, handleSelect]
  );

  const showClearButton = (inputValue.length > 0 || value) && !disabled;

  return (
    <div className={cn('relative', className)}>
      <Popover open={shouldShowDropdown} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              id={id}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (e.target.value.length >= 2) {
                  setOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => inputValue.length >= 2 && setOpen(true)}
              placeholder={value ? `Selected: ${extractFastId(value)}` : placeholder}
              className={cn('pl-9', showClearButton && 'pr-10')}
              disabled={disabled}
            />
            {isLoading && (
              <Loader2 className="absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
            {showClearButton && !isLoading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
                onClick={handleClear}
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Clear</span>
              </Button>
            )}
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
              {isLoading && suggestions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  <p className="mt-2">Searching FAST...</p>
                </div>
              ) : suggestions.length === 0 ? (
                <CommandEmpty>No FAST headings found</CommandEmpty>
              ) : (
                <CommandGroup heading="FAST Subject Headings">
                  {suggestions.map((suggestion, index) => (
                    <CommandItem
                      key={`fast-${suggestion.id}-${index}`}
                      value={suggestion.id}
                      onSelect={() => handleSelect(suggestion)}
                      className="cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{suggestion.label}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="default" className="text-xs">
                              FAST
                            </Badge>
                            <a
                              href={`https://id.worldcat.org/fast/${suggestion.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                        {suggestion.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {suggestion.description}
                          </p>
                        )}
                        {suggestion.usageCount !== null && suggestion.usageCount > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Used in {suggestion.usageCount.toLocaleString()} records
                          </p>
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

      {/* Show selected value badge */}
      {value && (
        <div className="mt-2">
          <Badge variant="secondary" className="gap-1">
            FAST: {extractFastId(value)}
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </Badge>
        </div>
      )}
    </div>
  );
}

/**
 * Extract FAST ID from URI.
 *
 * @param uri - Full FAST URI (e.g., "https://id.worldcat.org/fast/1234567")
 * @returns FAST ID (numeric string)
 */
function extractFastId(uri: string): string {
  if (!uri) return '';
  const parts = uri.split('/');
  return parts[parts.length - 1] ?? '';
}
