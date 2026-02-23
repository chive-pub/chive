'use client';

/**
 * Tag autocomplete component using the tag search endpoint.
 *
 * @remarks
 * Searches the folksonomy tag index (pub.chive.tag.search) which contains
 * user-applied tags with usage counts and quality scores. This is distinct
 * from the knowledge graph node search used by NodeAutocomplete.
 *
 * @packageDocumentation
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Hash, Loader2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTagSearch } from '@/lib/hooks/use-tags';

/**
 * Props for the TagAutocomplete component.
 */
export interface TagAutocompleteProps {
  /** Called when a tag is selected */
  onSelect: (tag: string) => void;
  /** Input placeholder */
  placeholder?: string;
  /** Tags already selected (to grey out in results) */
  existingTags?: string[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Autocomplete input for searching existing tags.
 *
 * Searches the tag index (pub.chive.tag.search) and displays matching
 * tags with usage counts. Resets after selection for adding multiple tags.
 */
export function TagAutocomplete({
  onSelect,
  placeholder = 'Search tags...',
  existingTags = [],
  className,
}: TagAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useTagSearch(query);
  const tags = data?.tags ?? [];

  const handleSelect = useCallback(
    (normalizedForm: string) => {
      onSelect(normalizedForm);
      setQuery('');
      setShowResults(false);
    },
    [onSelect]
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="pl-9"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {tags.length === 0 && !isLoading ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              No tags found for &quot;{query}&quot;
            </div>
          ) : (
            <ul className="max-h-[200px] overflow-y-auto py-1">
              {tags.map((tag) => {
                const isAlreadyAdded = existingTags.includes(tag.normalizedForm);
                return (
                  <li key={tag.normalizedForm}>
                    <button
                      type="button"
                      disabled={isAlreadyAdded}
                      onClick={() => handleSelect(tag.normalizedForm)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-3 py-2 text-sm',
                        isAlreadyAdded
                          ? 'cursor-default opacity-50'
                          : 'cursor-pointer hover:bg-accent'
                      )}
                    >
                      <span className="truncate">{tag.displayForms[0] ?? tag.normalizedForm}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {tag.usageCount} use{tag.usageCount !== 1 ? 's' : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
