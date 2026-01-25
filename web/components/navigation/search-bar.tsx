'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, FileText, User } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useInstantSearch } from '@/lib/hooks/use-search';
import { useAuthorSearch } from '@/lib/hooks/use-author';
import { useDebounce } from '@/lib/hooks/use-eprint-search';
import type { EnrichedSearchHit } from '@/lib/api/schema';

/**
 * Props for the SearchBar component.
 */
interface SearchBarProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Global search bar for the site header with eprint autocomplete.
 *
 * @remarks
 * Shows autocomplete suggestions from indexed eprints as user types.
 * Navigates to eprint page when suggestion is selected.
 * Navigates to search page on form submission.
 *
 * @example
 * ```tsx
 * <header>
 *   <SearchBar className="flex-1 max-w-md" />
 * </header>
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the search bar with autocomplete
 */
export function SearchBar({ className }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);
  const { data: eprintData, isLoading: isLoadingEprints } = useInstantSearch(debouncedQuery);
  const { data: authorData, isLoading: isLoadingAuthors } = useAuthorSearch(debouncedQuery, {
    limit: 3,
    enabled: debouncedQuery.length >= 2,
  });

  const isLoading = isLoadingEprints || isLoadingAuthors;

  // Cast to EnrichedSearchHit as the API returns enriched data
  const eprintSuggestions = (eprintData?.hits ?? []) as EnrichedSearchHit[];
  const authorSuggestions = authorData?.authors ?? [];

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        setIsOpen(false);
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, router]
  );

  const handleSelect = useCallback(
    (uri: string) => {
      setIsOpen(false);
      setQuery('');
      // Navigate to eprint page
      router.push(`/eprints/${encodeURIComponent(uri)}`);
    },
    [router]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (e.target.value.length >= 2) {
      setIsOpen(true);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      } else if (e.key === 'Enter' && !isOpen) {
        // Submit search when dropdown is closed
        handleSubmit(e);
      }
    },
    [isOpen, handleSubmit]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <Popover
      open={isOpen && (eprintSuggestions.length > 0 || authorSuggestions.length > 0)}
      onOpenChange={setIsOpen}
    >
      <PopoverTrigger asChild>
        <form
          role="search"
          aria-label="Search eprints and authors"
          onSubmit={handleSubmit}
          className={cn('relative w-full max-w-sm', className)}
        >
          <label htmlFor="header-search" className="sr-only">
            Search for eprints and authors
          </label>
          <Search
            className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={inputRef}
            id="header-search"
            type="search"
            placeholder="Search eprints & authors..."
            className="pl-8 pr-10"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && setIsOpen(true)}
            autoComplete="off"
          />
          {isLoading && (
            <Loader2 className="absolute right-10 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-9"
            aria-label="Submit search"
          >
            <span className="sr-only">Search</span>
          </Button>
        </form>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandList>
            {eprintSuggestions.length === 0 && authorSuggestions.length === 0 && !isLoading && (
              <CommandEmpty className="py-3 text-center text-sm">No results found</CommandEmpty>
            )}

            {/* Eprint suggestions */}
            {eprintSuggestions.length > 0 && (
              <CommandGroup heading="Eprints">
                {eprintSuggestions.map((hit) => (
                  <CommandItem
                    key={hit.uri}
                    value={hit.uri}
                    onSelect={() => handleSelect(hit.uri)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-start gap-2 w-full">
                      <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="font-medium line-clamp-1">{hit.title ?? 'Untitled'}</span>
                        {hit.authors && hit.authors.length > 0 && (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {hit.authors
                              .map((a: { name?: string }) => a.name ?? 'Unknown')
                              .join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Author suggestions */}
            {authorSuggestions.length > 0 && (
              <CommandGroup heading="Authors">
                {authorSuggestions.map((author) => (
                  <CommandItem
                    key={author.did}
                    value={author.did}
                    onSelect={() => {
                      setIsOpen(false);
                      setQuery('');
                      router.push(`/authors/${encodeURIComponent(author.did)}`);
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex items-start gap-2 w-full">
                      <User className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="font-medium line-clamp-1">
                          {author.displayName ?? author.handle ?? author.did}
                        </span>
                        {author.affiliation && (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {author.affiliation}
                          </span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {query.length >= 2 && (
              <div className="border-t px-2 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <Search className="h-4 w-4" />
                  <span>Search for &ldquo;{query}&rdquo;</span>
                </button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
