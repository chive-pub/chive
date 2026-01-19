'use client';

/**
 * DID autocomplete input with ATProto user search.
 *
 * @remarks
 * Allows searching for ATProto users by handle and auto-populates
 * their DID, display name, avatar, and Chive profile data (ORCID, affiliations).
 *
 * @packageDocumentation
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { AtSign, Loader2, Check } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/api/client';
import type { AuthorAffiliation } from './affiliation-input';

// =============================================================================
// TYPES
// =============================================================================

/**
 * ATProto actor from search results.
 */
interface AtprotoActor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
}

/**
 * Chive profile data from the backend.
 */
interface ChiveProfile {
  orcid?: string;
  affiliations?: AuthorAffiliation[];
}

/**
 * Selected user data passed to parent.
 */
export interface SelectedAtprotoUser {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  /** ORCID from Chive profile */
  orcid?: string;
  /** Affiliations from Chive profile */
  affiliations?: AuthorAffiliation[];
}

/**
 * Props for DidAutocompleteInput.
 */
export interface DidAutocompleteInputProps {
  /** Current DID value */
  value?: string;

  /** Callback when a user is selected */
  onSelect: (user: SelectedAtprotoUser) => void;

  /** Callback when value changes (for manual entry) */
  onChange?: (did: string) => void;

  /** Placeholder text */
  placeholder?: string;

  /** Disabled state */
  disabled?: boolean;

  /** Error state */
  error?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// ACTOR SEARCH HOOK
// =============================================================================

/**
 * Custom hook for searching ATProto actors.
 *
 * @remarks
 * First searches Chive for authors with eprints/profiles, then falls back
 * to Bluesky public API for broader ATProto user search.
 */
function useActorSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AtprotoActor[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search
  const debouncedSearch = useDebouncedCallback(async (searchQuery: string) => {
    // Remove @ prefix if present
    const cleanQuery = searchQuery.replace(/^@/, '').trim();

    if (!cleanQuery || cleanQuery.length < 2) {
      setResults([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    try {
      // Step 1: Search Chive authors first (users with eprints or profiles on Chive)
      const baseUrl = getApiBaseUrl();
      let chiveActors: AtprotoActor[] = [];

      try {
        const chiveResponse = await fetch(
          `${baseUrl}/xrpc/pub.chive.author.searchAuthors?query=${encodeURIComponent(cleanQuery)}&limit=8`,
          { signal: controller.signal }
        );

        if (chiveResponse.ok) {
          const chiveData = await chiveResponse.json();
          chiveActors = (chiveData.authors ?? []).map(
            (author: {
              did: string;
              handle?: string;
              displayName?: string;
              avatar?: string;
              hasEprints: boolean;
              hasProfile: boolean;
            }) => ({
              did: author.did,
              handle: author.handle ?? author.did.split(':')[2]?.slice(0, 8) ?? 'unknown',
              displayName: author.displayName,
              avatar: author.avatar,
              description: author.hasEprints ? 'Has eprints on Chive' : 'Has Chive profile',
            })
          );
        }
      } catch {
        // Chive search failed, continue with Bluesky fallback
      }

      // Step 2: Fall back to Bluesky public API if no Chive results
      if (chiveActors.length === 0) {
        const bskyResponse = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(cleanQuery)}&limit=8`,
          { signal: controller.signal }
        );

        if (!bskyResponse.ok) {
          throw new Error('Actor search failed');
        }

        const bskyData = await bskyResponse.json();
        const bskyActors: AtprotoActor[] = (bskyData.actors ?? []).map(
          (actor: {
            did: string;
            handle: string;
            displayName?: string;
            avatar?: string;
            description?: string;
          }) => ({
            did: actor.did,
            handle: actor.handle,
            displayName: actor.displayName,
            avatar: actor.avatar,
            description: actor.description,
          })
        );

        setResults(bskyActors);
      } else {
        setResults(chiveActors);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Actor search error:', error);
        setResults([]);
      }
    } finally {
      setIsSearching(false);
    }
  }, 300);

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching,
    clearResults: () => setResults([]),
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Gets initials from a name or handle.
 */
function getInitials(name?: string, handle?: string): string {
  const text = name || handle || '?';
  const parts = text.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Fetches the Chive profile for a user to get ORCID and affiliations.
 */
async function fetchChiveProfile(did: string): Promise<ChiveProfile | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(
      `${baseUrl}/xrpc/pub.chive.author.getProfile?did=${encodeURIComponent(did)}`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    // Profile data is nested under 'profile' in the API response
    const profile = data.profile;
    if (!profile) {
      return null;
    }

    return {
      orcid: profile.orcid ?? undefined,
      affiliations:
        profile.affiliations?.map((aff: { name: string; rorId?: string; department?: string }) => ({
          name: aff.name,
          rorId: aff.rorId,
          department: aff.department,
        })) ?? undefined,
    };
  } catch {
    // Profile fetch is best-effort, don't fail selection
    return null;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Input for searching and selecting ATProto users by handle.
 */
export function DidAutocompleteInput({
  value,
  onSelect,
  onChange,
  placeholder = 'Search by handle (e.g., alice.bsky.social)...',
  disabled = false,
  error = false,
  className,
}: DidAutocompleteInputProps) {
  const { query, setQuery, results, isSearching, clearResults } = useActorSearch();
  const [showResults, setShowResults] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SelectedAtprotoUser | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // If value is set externally and we don't have a selected user, show the DID
  const displayValue = selectedUser ? `@${selectedUser.handle}` : value ? value : query;

  const handleSelectActor = useCallback(
    async (actor: AtprotoActor) => {
      // Build initial user object
      const user: SelectedAtprotoUser = {
        did: actor.did,
        handle: actor.handle,
        displayName: actor.displayName,
        avatar: actor.avatar,
      };

      // Update UI immediately
      setSelectedUser(user);
      setQuery('');
      clearResults();
      setShowResults(false);

      // Fetch Chive profile in background to get ORCID and affiliations
      const profile = await fetchChiveProfile(actor.did);
      if (profile) {
        const enrichedUser: SelectedAtprotoUser = {
          ...user,
          orcid: profile.orcid,
          affiliations: profile.affiliations,
        };
        setSelectedUser(enrichedUser);
        onSelect(enrichedUser);
      } else {
        onSelect(user);
      }
    },
    [onSelect, setQuery, clearResults]
  );

  const handleClear = useCallback(() => {
    setSelectedUser(null);
    setQuery('');
    clearResults();
    onChange?.('');
  }, [setQuery, clearResults, onChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;

      // If user is typing, clear selected user
      if (selectedUser) {
        setSelectedUser(null);
      }

      // Check if it looks like a DID (manual entry)
      if (newValue.startsWith('did:')) {
        onChange?.(newValue);
        setQuery('');
        clearResults();
      } else {
        setQuery(newValue);
        setShowResults(true);
        onChange?.('');
      }
    },
    [selectedUser, onChange, setQuery, clearResults]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowResults(false);
      }
      if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        handleSelectActor(results[0]);
      }
    },
    [results, handleSelectActor]
  );

  return (
    <div className={cn('relative', className)} data-testid="did-autocomplete-input">
      <div className="relative">
        {selectedUser ? (
          // Show selected user chip
          <div
            className={cn(
              'flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2',
              disabled && 'opacity-50'
            )}
          >
            <Avatar className="h-6 w-6">
              {selectedUser.avatar && (
                <AvatarImage src={selectedUser.avatar} alt={selectedUser.handle} />
              )}
              <AvatarFallback className="text-[10px]">
                {getInitials(selectedUser.displayName, selectedUser.handle)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {selectedUser.displayName && (
                  <span className="font-medium text-sm truncate">{selectedUser.displayName}</span>
                )}
                <span className="text-xs text-muted-foreground truncate">
                  @{selectedUser.handle}
                </span>
              </div>
            </div>
            <Check className="h-4 w-4 text-green-600 shrink-0" />
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Clear selection"
              >
                ×
              </button>
            )}
          </div>
        ) : (
          // Show search input
          <>
            <AtSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={displayValue}
              onChange={handleInputChange}
              onFocus={() => setShowResults(true)}
              onBlur={() => {
                // Delay to allow click on results
                setTimeout(() => setShowResults(false), 200);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className={cn('pl-9 pr-9', error && 'border-destructive')}
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </>
        )}
      </div>

      {/* Search results dropdown */}
      {showResults && !selectedUser && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="max-h-64 overflow-y-auto p-1">
            {results.map((actor) => (
              <button
                key={actor.did}
                type="button"
                onClick={() => handleSelectActor(actor)}
                className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {actor.avatar && <AvatarImage src={actor.avatar} alt={actor.handle} />}
                  <AvatarFallback className="text-xs">
                    {getInitials(actor.displayName, actor.handle)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    {actor.displayName && (
                      <span className="font-medium truncate">{actor.displayName}</span>
                    )}
                    <span className="text-xs text-muted-foreground truncate">@{actor.handle}</span>
                  </div>
                  {actor.description && (
                    <p className="text-xs text-muted-foreground truncate">{actor.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Helper text */}
      {!selectedUser && !value && (
        <p className="mt-1 text-xs text-muted-foreground">
          Search for an ATProto user by handle, or paste a DID directly
        </p>
      )}
    </div>
  );
}
