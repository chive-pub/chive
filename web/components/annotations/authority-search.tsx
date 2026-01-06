'use client';

/**
 * Chive authority record search component.
 *
 * @remarks
 * Searches Chive authority records (established vocabulary terms).
 * Authorities are community-approved terms for consistent classification.
 *
 * @example
 * ```tsx
 * <AuthoritySearch
 *   query="neural networks"
 *   onSelect={handleSelect}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Loader2 } from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Authority record result.
 */
export interface AuthorityResult {
  /** AT-URI */
  uri: string;

  /** Preferred authorized form */
  authorizedForm: string;

  /** Alternative forms */
  variantForms: string[];

  /** Scope note */
  scopeNote?: string;

  /** Status */
  status: 'established' | 'provisional' | 'deprecated';

  /** Usage count */
  usageCount: number;
}

/**
 * Props for AuthoritySearch.
 */
export interface AuthoritySearchProps {
  /** Search query */
  query: string;

  /** Callback when authority is selected */
  onSelect: (authority: AuthorityResult) => void;

  /** Maximum results */
  limit?: number;

  /** Include provisional authorities */
  includeProvisional?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// API
// =============================================================================

async function searchAuthorities(
  query: string,
  _limit: number,
  _includeProvisional: boolean
): Promise<AuthorityResult[]> {
  if (query.length < 2) return [];

  // Mock implementation; replace with actual API call.
  // const response = await apiClient.get('/xrpc/pub.chive.graph.searchAuthorities', {
  //   params: { query, limit, includeProvisional }
  // });
  // return response.authorities;

  // For now, return empty; API not yet implemented.
  return [];
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Search Chive authority records.
 *
 * @param props - Component props
 * @returns Search results element
 */
export function AuthoritySearch({
  query,
  onSelect,
  limit = 10,
  includeProvisional = false,
  className,
}: AuthoritySearchProps) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const {
    data: results,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['authorities', 'search', debouncedQuery, limit, includeProvisional],
    queryFn: () => searchAuthorities(debouncedQuery, limit, includeProvisional),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const getStatusColor = (status: AuthorityResult['status']) => {
    switch (status) {
      case 'established':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'provisional':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'deprecated':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
  };

  return (
    <Command className={cn('', className)} data-testid="authority-search">
      <CommandList>
        {isLoading && (
          <div className="flex items-center justify-center py-6" role="status" aria-label="Loading">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="py-6 text-center text-sm text-destructive">Search failed. Try again.</div>
        )}

        {!isLoading && !error && query.length < 2 && (
          <CommandEmpty>Type at least 2 characters to search</CommandEmpty>
        )}

        {!isLoading && !error && query.length >= 2 && results?.length === 0 && (
          <CommandEmpty>No authority records found</CommandEmpty>
        )}

        {results && results.length > 0 && (
          <CommandGroup heading="Authorities">
            {results.map((authority) => (
              <CommandItem
                key={authority.uri}
                value={authority.authorizedForm}
                onSelect={() => onSelect(authority)}
                className="cursor-pointer"
              >
                <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground mr-2" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{authority.authorizedForm}</span>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', getStatusColor(authority.status))}
                    >
                      {authority.status}
                    </Badge>
                  </div>
                  {authority.scopeNote && (
                    <p className="text-xs text-muted-foreground truncate">{authority.scopeNote}</p>
                  )}
                  {authority.variantForms.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Also: {authority.variantForms.slice(0, 3).join(', ')}
                      {authority.variantForms.length > 3 && '...'}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {authority.usageCount}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}
