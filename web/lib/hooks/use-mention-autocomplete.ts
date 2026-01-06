'use client';

/**
 * Hook for Bluesky mention autocomplete.
 *
 * @remarks
 * Provides debounced actor search using the public Bluesky API.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';

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
 * Result of the useMentionAutocomplete hook.
 */
interface UseMentionAutocompleteResult {
  /** Search results */
  suggestions: ActorSuggestion[];
  /** Whether search is in progress */
  isLoading: boolean;
  /** Search for actors */
  search: (query: string) => void;
  /** Clear suggestions */
  clear: () => void;
}

/** Bluesky public API endpoint */
const BLUESKY_PUBLIC_API = 'https://public.api.bsky.app';

/**
 * Hook for Bluesky mention autocomplete.
 *
 * @param debounceMs - Debounce delay in milliseconds (default: 200)
 * @returns Hook result with suggestions and search function
 *
 * @example
 * ```tsx
 * function MentionInput() {
 *   const { suggestions, isLoading, search, clear } = useMentionAutocomplete();
 *
 *   const handleChange = (e) => {
 *     const query = extractMentionQuery(e.target.value);
 *     if (query) {
 *       search(query);
 *     } else {
 *       clear();
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <input onChange={handleChange} />
 *       {suggestions.map(actor => (
 *         <div key={actor.did}>{actor.handle}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMentionAutocomplete(debounceMs: number = 200): UseMentionAutocompleteResult {
  const [suggestions, setSuggestions] = useState<ActorSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const currentQueryRef = useRef('');

  // Debounced search function
  const debouncedSearch = useDebouncedCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${BLUESKY_PUBLIC_API}/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(query)}&limit=8`
      );

      if (response.ok) {
        const data = (await response.json()) as { actors: ActorSuggestion[] };

        // Only update if this is still the current query
        if (query === currentQueryRef.current) {
          setSuggestions(data.actors || []);
        }
      } else {
        setSuggestions([]);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, debounceMs);

  // Search function
  const search = useCallback(
    (query: string) => {
      currentQueryRef.current = query;
      debouncedSearch(query);
    },
    [debouncedSearch]
  );

  // Clear function
  const clear = useCallback(() => {
    currentQueryRef.current = '';
    setSuggestions([]);
    setIsLoading(false);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  return {
    suggestions,
    isLoading,
    search,
    clear,
  };
}
