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
import { useState, useCallback, useRef, useEffect, useId } from 'react';
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

  // Index of the option keyboard focus is on, or -1 for none.
  //
  // The combobox pattern keeps DOM focus in the input and moves a *virtual*
  // cursor over the listbox, announced through `aria-activedescendant`. Moving
  // real focus into the list would take it off the text field the user is
  // typing in.
  const [activeIndex, setActiveIndex] = useState(-1);

  // Stable ids so `aria-controls` and `aria-activedescendant` can point at the
  // listbox and the active option.
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  // A new result set invalidates the cursor.
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

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

  /**
   * Keyboard interaction for the combobox pattern.
   *
   * @remarks
   * Previously the only key handled anywhere in this family was Escape, so a
   * keyboard user could open a list of suggestions and had no way to choose
   * one. Arrow keys move the virtual cursor, Home and End jump to the ends,
   * Enter commits, and Escape closes without committing — which is the whole
   * contract a screen reader user is entitled to expect from `role="combobox"`.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setActiveIndex(-1);
        return;
      }

      if (!open || results.length === 0) {
        // Down opens a closed list rather than doing nothing.
        if (event.key === 'ArrowDown' && inputValue.length >= minChars) {
          event.preventDefault();
          setOpen(true);
        }
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndex((i) => (i + 1) % results.length);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
          break;
        case 'Home':
          event.preventDefault();
          setActiveIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setActiveIndex(results.length - 1);
          break;
        case 'Enter': {
          const item = results[activeIndex];
          if (item !== undefined) {
            // Only when a suggestion is actually highlighted; otherwise Enter
            // belongs to the surrounding form.
            event.preventDefault();
            handleSelect(item);
          }
          break;
        }
        default:
          break;
      }
    },
    [open, results, activeIndex, handleSelect, inputValue.length, minChars]
  );

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
              onKeyDown={handleKeyDown}
              disabled={disabled}
              className={cn(showClearButton && 'pr-10')}
              role="combobox"
              aria-expanded={open && shouldSearch}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 && open ? optionId(activeIndex) : undefined}
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
              <CommandList id={listboxId} role="listbox">
                {results.length === 0 && !isLoading ? (
                  <CommandEmpty>{emptyMessage}</CommandEmpty>
                ) : (
                  <CommandGroup heading={groupLabel}>
                    {results.map((item, index) => {
                      const key = getItemKey(item);
                      const isSelected = selectedValue != null && getItemKey(selectedValue) === key;
                      const isActive = index === activeIndex;
                      return (
                        <CommandItem
                          key={key}
                          id={optionId(index)}
                          role="option"
                          aria-selected={isActive}
                          value={key}
                          onSelect={() => handleSelect(item)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={cn('cursor-pointer', isActive && 'bg-accent')}
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
