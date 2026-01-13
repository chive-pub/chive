'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Props for the SearchBar component.
 */
interface SearchBarProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Global search bar for the site header.
 *
 * @remarks
 * Navigates to the search page on form submission.
 * Includes proper accessibility attributes with aria-label and screen reader text.
 *
 * @example
 * ```tsx
 * <header>
 *   <SearchBar className="flex-1 max-w-md" />
 * </header>
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the search bar
 */
export function SearchBar({ className }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, router]
  );

  return (
    <form
      role="search"
      aria-label="Search eprints"
      onSubmit={handleSubmit}
      className={cn('relative w-full max-w-sm', className)}
    >
      <label htmlFor="header-search" className="sr-only">
        Search for eprints
      </label>
      <Search
        className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id="header-search"
        type="search"
        placeholder="Search eprints..."
        className="pl-8 pr-10"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
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
  );
}
