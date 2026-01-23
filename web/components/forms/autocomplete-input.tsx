'use client';

/**
 * Generic autocomplete input component.
 *
 * @remarks
 * Reusable autocomplete input that combines:
 * - cmdk for accessible keyboard navigation
 * - Popover for dropdown positioning
 * - useQuery for data fetching with caching
 * - Debounced search for performance
 *
 * @example
 * ```tsx
 * <AutocompleteInput
 *   placeholder="Search DOIs..."
 *   queryFn={async (q) => searchCrossRef(q)}
 *   onSelect={(item) => setValue('doi', item.doi)}
 *   renderItem={(item) => <DoiItem item={item} />}
 *   getItemValue={(item) => item.doi}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Check, X } from 'lucide-react';
import { logger } from '@/lib/observability';

const autocompleteLogger = logger.child({ component: 'autocomplete-input' });

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useDebounce } from '@/lib/hooks/use-eprint-search';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for AutocompleteInput component.
 */
export interface AutocompleteInputProps<T> {
  /** Input placeholder text */
  placeholder?: string;
  /** Label for the autocomplete group */
  groupLabel?: string;
  /** Function to search for items */
  queryFn: (query: string) => Promise<T[]>;
  /** Query key prefix for react-query caching */
  queryKeyPrefix: string;
  /** Called when an item is selected */
  onSelect: (item: T) => void;
  /** Called when input value changes (for controlled input) */
  onInputChange?: (value: string) => void;
  /** Render function for each item in the list */
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  /** Get unique key for item */
  getItemKey: (item: T) => string;
  /** Get display value for selected item */
  getItemValue: (item: T) => string;
  /** Initial input value */
  initialValue?: string;
  /** Minimum characters before searching */
  minChars?: number;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Stale time for cached results */
  staleTime?: number;
  /** Message when no results found */
  emptyMessage?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Allow clearing the selected value */
  clearable?: boolean;
  /** Additional class names */
  className?: string;
  /** Current selected value (for controlled mode) */
  selectedValue?: T | null;
  /** Called when selection is cleared */
  onClear?: () => void;
  /** Input ID for accessibility */
  id?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Generic autocomplete input with search suggestions.
 *
 * @param props - Component props
 * @returns Autocomplete input element
 */
export function AutocompleteInput<T>({
  placeholder = 'Search...',
  groupLabel = 'Results',
  queryFn,
  queryKeyPrefix,
  onSelect,
  onInputChange,
  renderItem,
  getItemKey,
  getItemValue,
  initialValue = '',
  minChars = 2,
  debounceMs = 300,
  staleTime = 30 * 1000,
  emptyMessage = 'No results found.',
  disabled = false,
  clearable = true,
  className,
  selectedValue,
  onClear,
  id,
}: AutocompleteInputProps<T>) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(inputValue, debounceMs);
  const shouldSearch = debouncedQuery.length >= minChars;

  // Query for autocomplete results
  const { data: results = [], isLoading } = useQuery({
    queryKey: [queryKeyPrefix, debouncedQuery],
    queryFn: () => queryFn(debouncedQuery),
    enabled: shouldSearch,
    staleTime,
  });

  // Update input when selected value changes (controlled mode)
  useEffect(() => {
    if (selectedValue) {
      setInputValue(getItemValue(selectedValue));
    }
  }, [selectedValue, getItemValue]);

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);
      onInputChange?.(value);
      if (value.length >= minChars) {
        setOpen(true);
      }
    },
    [minChars, onInputChange]
  );

  // Handle item selection
  const handleSelect = useCallback(
    (item: T) => {
      setInputValue(getItemValue(item));
      setOpen(false);
      onSelect(item);
    },
    [getItemValue, onSelect]
  );

  // Handle clear
  const handleClear = useCallback(() => {
    setInputValue('');
    onClear?.();
    inputRef.current?.focus();
  }, [onClear]);

  // Handle focus
  const handleFocus = useCallback(() => {
    if (inputValue.length >= minChars) {
      setOpen(true);
    }
  }, [inputValue.length, minChars]);

  // Handle blur with delay to allow click on items
  const handleBlur = useCallback(() => {
    // Small delay to allow click events to fire
    setTimeout(() => setOpen(false), 200);
  }, []);

  const showClearButton = clearable && inputValue.length > 0 && !disabled;

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              id={id}
              type="text"
              placeholder={placeholder}
              value={inputValue}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              disabled={disabled}
              className={cn(showClearButton && 'pr-10')}
            />
            {isLoading && shouldSearch && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
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
        {shouldSearch && (
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command>
              <CommandList>
                {results.length === 0 && !isLoading ? (
                  <CommandEmpty>{emptyMessage}</CommandEmpty>
                ) : (
                  <CommandGroup heading={groupLabel}>
                    {results.map((item) => {
                      const key = getItemKey(item);
                      const isSelected = selectedValue != null && getItemKey(selectedValue) === key;
                      return (
                        <CommandItem
                          key={key}
                          value={key}
                          onSelect={() => handleSelect(item)}
                          className="cursor-pointer"
                        >
                          {isSelected && <Check className="mr-2 h-4 w-4 shrink-0" />}
                          <div className={cn(!isSelected && 'ml-6', 'flex-1')}>
                            {renderItem(item, isSelected)}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}

/**
 * Hook to create autocomplete search function with API endpoint.
 *
 * @param endpoint - API endpoint path
 * @param transformResponse - Function to transform API response
 * @returns Search function for AutocompleteInput
 *
 * @example
 * ```tsx
 * const searchDoi = useAutocompleteSearch<CrossRefWork>(
 *   '/xrpc/pub.chive.autocomplete.doi',
 *   (data) => data.items
 * );
 * ```
 */
export function useAutocompleteSearch<T>(
  endpoint: string,
  transformResponse: (data: unknown) => T[]
): (query: string) => Promise<T[]> {
  return useCallback(
    async (query: string): Promise<T[]> => {
      const url = `${endpoint}?q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      if (!response.ok) {
        autocompleteLogger.error('Autocomplete search failed', undefined, {
          endpoint,
          status: response.status,
          statusText: response.statusText,
        });
        return [];
      }
      const data = await response.json();
      return transformResponse(data);
    },
    [endpoint, transformResponse]
  );
}
