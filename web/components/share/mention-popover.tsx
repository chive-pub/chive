'use client';

/**
 * Mention autocomplete popover for Bluesky composer.
 *
 * @remarks
 * Shows actor search results for @mentions with keyboard navigation.
 * Uses the public Bluesky actor typeahead API.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, User } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { cn } from '@/lib/utils';
import type { AutocompleteTrigger } from './bluesky-composer';

/**
 * Actor suggestion from Bluesky API.
 */
export interface ActorSuggestion {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

/**
 * Props for the MentionPopover component.
 */
interface MentionPopoverProps {
  /** Current autocomplete trigger (null = hidden) */
  trigger: AutocompleteTrigger | null;
  /** Called when an actor is selected */
  onSelect: (actor: ActorSuggestion) => void;
  /** Called when popover should close */
  onClose: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Search actors using Bluesky public API.
 */
async function searchActors(query: string): Promise<ActorSuggestion[]> {
  if (!query || query.length < 1) {
    return [];
  }

  try {
    const response = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(query)}&limit=8`
    );

    if (response.ok) {
      const data = (await response.json()) as { actors: ActorSuggestion[] };
      return data.actors || [];
    }
  } catch {
    // Silently fail on network errors
  }

  return [];
}

/**
 * Mention autocomplete popover component.
 *
 * @example
 * ```tsx
 * <MentionPopover
 *   trigger={autocompleteTrigger}
 *   onSelect={(actor) => insertMention(actor.handle)}
 *   onClose={() => setAutocompleteTrigger(null)}
 * />
 * ```
 */
export function MentionPopover({ trigger, onSelect, onClose, className }: MentionPopoverProps) {
  const [suggestions, setSuggestions] = useState<ActorSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const debouncedSearch = useDebouncedCallback(async (query: string) => {
    setIsLoading(true);
    const results = await searchActors(query);
    setSuggestions(results);
    setSelectedIndex(0);
    setIsLoading(false);
  }, 200);

  // Search when trigger query changes
  useEffect(() => {
    if (trigger?.type === 'mention' && trigger.query) {
      debouncedSearch(trigger.query);
    } else {
      setSuggestions([]);
    }
  }, [trigger?.query, trigger?.type, debouncedSearch]);

  // Handle keyboard navigation (global)
  useEffect(() => {
    if (!trigger || trigger.type !== 'mention') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;
        case 'Enter':
        case 'Tab':
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            e.preventDefault();
            onSelect(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [trigger, suggestions, selectedIndex, onSelect, onClose]);

  // Handle click selection
  const handleClick = useCallback(
    (actor: ActorSuggestion) => {
      onSelect(actor);
    },
    [onSelect]
  );

  // Don't render if no trigger or not a mention
  if (!trigger || trigger.type !== 'mention') {
    return null;
  }

  return (
    <div
      ref={popoverRef}
      className={cn('absolute z-50 w-72 rounded-md border bg-popover shadow-lg', className)}
      style={{
        top: `${trigger.position.top}px`,
        left: `${trigger.position.left}px`,
      }}
    >
      {isLoading && (
        <div className="flex items-center justify-center p-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && suggestions.length > 0 && (
        <ul className="max-h-60 overflow-auto py-1" role="listbox">
          {suggestions.map((actor, index) => (
            <li
              key={actor.did}
              role="option"
              aria-selected={index === selectedIndex}
              className={cn(
                'flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent',
                index === selectedIndex && 'bg-accent'
              )}
              onClick={() => handleClick(actor)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {actor.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={actor.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                {actor.displayName && (
                  <p className="truncate text-sm font-medium">{actor.displayName}</p>
                )}
                <p className="truncate text-sm text-muted-foreground">@{actor.handle}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && trigger.query.length >= 1 && suggestions.length === 0 && (
        <div className="p-3">
          <p className="text-center text-sm text-muted-foreground">No users found</p>
        </div>
      )}
    </div>
  );
}
