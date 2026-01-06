'use client';

/**
 * Tag input with autocomplete suggestions.
 *
 * @example
 * ```tsx
 * <TagInput
 *   existingTags={tags}
 *   onTagAdd={handleAdd}
 *   onTagRemove={handleRemove}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Plus, Search, Loader2 } from 'lucide-react';

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
import { useTagSuggestions } from '@/lib/hooks/use-tags';
import type { TagSummary } from '@/lib/api/schema';
import { TagChip } from './tag-chip';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for TagInput.
 */
export interface TagInputProps {
  /** Currently applied tags */
  existingTags: Array<TagSummary | string>;

  /** Callback when tag is added */
  onTagAdd: (tag: string) => void;

  /** Callback when tag is removed */
  onTagRemove: (tag: TagSummary | string) => void;

  /** Maximum number of tags allowed */
  maxTags?: number;

  /** Placeholder text */
  placeholder?: string;

  /** Disabled state */
  disabled?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function normalizeTag(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

function getTagNormalized(tag: TagSummary | string): string {
  return typeof tag === 'string' ? normalizeTag(tag) : tag.normalizedForm;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Input field for adding and removing tags with autocomplete.
 *
 * @param props - Component props
 * @returns Tag input element
 */
export function TagInput({
  existingTags,
  onTagAdd,
  onTagRemove,
  maxTags = 10,
  placeholder = 'Add a tag...',
  disabled = false,
  className,
}: TagInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const { data: suggestions, isLoading } = useTagSuggestions(query, {
    enabled: query.length >= 2,
  });

  const existingNormalized = useMemo(
    () => new Set(existingTags.map(getTagNormalized)),
    [existingTags]
  );
  const canAddMore = existingTags.length < maxTags;

  // Filter out already-added tags from suggestions
  const filteredSuggestions = (suggestions ?? []).filter(
    (s) => !existingNormalized.has(s.normalizedForm)
  );

  const handleAddTag = useCallback(
    (value: string) => {
      const normalized = normalizeTag(value);
      if (normalized.length < 2) return;
      if (existingNormalized.has(normalized)) return;
      if (!canAddMore) return;

      onTagAdd(normalized);
      setQuery('');
      setIsOpen(false);
    },
    [existingNormalized, canAddMore, onTagAdd]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag(query);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    },
    [query, handleAddTag]
  );

  // Open popover when typing
  useEffect(() => {
    if (query.length >= 2) {
      setIsOpen(true);
    }
  }, [query]);

  return (
    <div className={cn('space-y-2', className)} data-testid="tag-input">
      {/* Existing tags */}
      {existingTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {existingTags.map((tag) => {
            const key = typeof tag === 'string' ? tag : tag.normalizedForm;
            return <TagChip key={key} tag={tag} onRemove={() => onTagRemove(tag)} size="md" />;
          })}
        </div>
      )}

      {/* Input with autocomplete */}
      {canAddMore && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => query.length >= 2 && setIsOpen(true)}
                placeholder={placeholder}
                disabled={disabled}
                className="pl-9 pr-20"
                aria-label="Tag input"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="absolute right-1 top-1/2 h-7 -translate-y-1/2 gap-1"
                onClick={() => handleAddTag(query)}
                disabled={disabled || query.length < 2}
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
          </PopoverTrigger>

          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command>
              <CommandList>
                {isLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!isLoading && filteredSuggestions.length === 0 && query.length >= 2 && (
                  <CommandEmpty className="py-3 text-center text-sm">
                    Press Enter to add &quot;{normalizeTag(query)}&quot;
                  </CommandEmpty>
                )}

                {filteredSuggestions.length > 0 && (
                  <CommandGroup heading="Suggestions">
                    {filteredSuggestions.map((suggestion) => (
                      <CommandItem
                        key={suggestion.normalizedForm}
                        value={suggestion.normalizedForm}
                        onSelect={() => handleAddTag(suggestion.displayForm)}
                        className="cursor-pointer"
                      >
                        <span>{suggestion.displayForm}</span>
                        <span className="ml-auto text-xs text-muted-foreground capitalize">
                          {suggestion.source}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {/* Tag limit indicator */}
      <p className="text-xs text-muted-foreground">
        {existingTags.length}/{maxTags} tags
      </p>
    </div>
  );
}
