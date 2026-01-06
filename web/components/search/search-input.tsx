'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Props for the SearchInput component.
 */
export interface SearchInputProps {
  /** Default search query value */
  defaultValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Called when search is submitted */
  onSearch?: (query: string) => void;
  /** Called on every input change (for instant search) */
  onChange?: (query: string) => void;
  /** Whether search is loading */
  isLoading?: boolean;
  /** Size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Whether to show autocomplete */
  showAutocomplete?: boolean;
  /** Autocomplete component to render */
  autocomplete?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Search input with submit handling and optional autocomplete.
 *
 * @remarks
 * Client component that handles form submission, keyboard navigation,
 * and integrates with autocomplete dropdown.
 *
 * @example
 * ```tsx
 * <SearchInput
 *   defaultValue={query}
 *   onSearch={(q) => router.push(`/search?q=${q}`)}
 *   placeholder="Search preprints..."
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element with search input
 */
export function SearchInput({
  defaultValue = '',
  placeholder = 'Search preprints...',
  onSearch,
  onChange,
  isLoading = false,
  size = 'default',
  showAutocomplete = false,
  autocomplete,
  className,
}: SearchInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedValue = value.trim();
      if (trimmedValue && onSearch) {
        onSearch(trimmedValue);
        inputRef.current?.blur();
      }
    },
    [value, onSearch]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      onChange?.(newValue);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    setValue('');
    onChange?.('');
    inputRef.current?.focus();
  }, [onChange]);

  const inputHeight = size === 'sm' ? 'h-9' : size === 'lg' ? 'h-12' : 'h-10';
  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <div className={cn('relative', className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground',
              iconSize
            )}
          />
          <Input
            ref={inputRef}
            type="search"
            value={value}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={placeholder}
            className={cn('pl-10 pr-20', inputHeight, size === 'lg' && 'text-lg')}
            aria-label="Search"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
              </Button>
            )}
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </form>

      {/* Autocomplete dropdown */}
      {showAutocomplete && isFocused && value.length >= 2 && autocomplete}
    </div>
  );
}

/**
 * Props for the SearchInputWithParams component.
 */
export interface SearchInputWithParamsProps extends Omit<
  SearchInputProps,
  'defaultValue' | 'onSearch'
> {
  /** Search params key for the query */
  paramKey?: string;
  /** Target route for search */
  searchRoute?: string;
}

/**
 * Search input that syncs with URL search params.
 *
 * @remarks
 * Automatically reads from and writes to URL search params,
 * useful for pages with shareable search URLs.
 *
 * @example
 * ```tsx
 * <SearchInputWithParams
 *   paramKey="q"
 *   searchRoute="/search"
 * />
 * ```
 */
export function SearchInputWithParams({
  paramKey = 'q',
  searchRoute = '/search',
  ...props
}: SearchInputWithParamsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultValue = searchParams.get(paramKey) ?? '';

  const handleSearch = useCallback(
    (query: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (query) {
        params.set(paramKey, query);
      } else {
        params.delete(paramKey);
      }
      router.push(`${searchRoute}?${params.toString()}`);
    },
    [router, searchParams, paramKey, searchRoute]
  );

  return <SearchInput defaultValue={defaultValue} onSearch={handleSearch} {...props} />;
}

/**
 * Props for the InlineSearch component.
 */
export interface InlineSearchProps {
  /** Placeholder text */
  placeholder?: string;
  /** Called when search is submitted */
  onSearch: (query: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compact inline search for headers and sidebars.
 *
 * @example
 * ```tsx
 * <InlineSearch
 *   placeholder="Quick search..."
 *   onSearch={(q) => navigateToSearch(q)}
 * />
 * ```
 */
export function InlineSearch({
  placeholder = 'Search...',
  onSearch,
  className,
}: InlineSearchProps) {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (value.trim()) {
        onSearch(value.trim());
        setValue('');
      }
    },
    [value, onSearch]
  );

  return (
    <form onSubmit={handleSubmit} className={cn('relative', className)}>
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full pl-8 pr-3 text-sm"
      />
    </form>
  );
}
