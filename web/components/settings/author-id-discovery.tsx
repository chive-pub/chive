'use client';

/**
 * Author ID Discovery component.
 *
 * @remarks
 * Helps users discover their external author IDs by searching
 * OpenAlex and Semantic Scholar based on their name.
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { Search, Loader2, ExternalLink, CheckCircle2, User, Building2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthorIdDiscovery, type AuthorIdMatch } from '@/lib/hooks/use-profile-autocomplete';

export interface AuthorIdDiscoveryProps {
  /** Current user's display name for initial search */
  displayName?: string;
  /** Callback when user selects IDs to use */
  onSelectIds?: (ids: {
    openAlexId?: string;
    semanticScholarId?: string;
    orcid?: string;
    dblpId?: string;
  }) => void;
  /** Additional class name */
  className?: string;
}

/**
 * Format large numbers with abbreviations.
 */
function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Author ID Discovery panel.
 *
 * @remarks
 * Searches OpenAlex and Semantic Scholar to help users find and link
 * their external author profiles based on name matching.
 */
export function AuthorIdDiscovery({
  displayName = '',
  onSelectIds,
  className,
}: AuthorIdDiscoveryProps) {
  const [searchName, setSearchName] = React.useState(displayName);
  const [hasSearched, setHasSearched] = React.useState(false);

  const { data, isLoading, refetch } = useAuthorIdDiscovery(searchName, {
    enabled: false, // Manual trigger only
  });

  const handleSearch = React.useCallback(() => {
    if (searchName.trim().length >= 2) {
      setHasSearched(true);
      refetch();
    }
  }, [searchName, refetch]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch]
  );

  const handleSelectMatch = React.useCallback(
    (match: AuthorIdMatch) => {
      if (onSelectIds) {
        onSelectIds({
          openAlexId: match.ids.openalex ?? undefined,
          semanticScholarId: match.ids.semanticScholar ?? undefined,
          orcid: match.ids.orcid ?? undefined,
          dblpId: match.ids.dblp ?? undefined,
        });
      }
    },
    [onSelectIds]
  );

  // Update search name when displayName prop changes
  React.useEffect(() => {
    if (displayName && !hasSearched) {
      setSearchName(displayName);
    }
  }, [displayName, hasSearched]);

  const matches = data?.matches ?? [];

  return (
    <Card className={cn('border-dashed', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4" />
          Discover Your Author IDs
        </CardTitle>
        <CardDescription>
          Search academic databases to find and link your author profiles automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your name to search..."
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            onClick={handleSearch}
            disabled={isLoading || searchName.trim().length < 2}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" />
            <p>Searching OpenAlex & Semantic Scholar...</p>
          </div>
        )}

        {/* Results */}
        {!isLoading && hasSearched && matches.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <p>No matching author profiles found.</p>
            <p className="mt-1 text-xs">Try a different name spelling or add IDs manually below.</p>
          </div>
        )}

        {!isLoading && matches.length > 0 && (
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Potential Matches ({matches.length})
            </Label>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {matches.map((match, index) => (
                <div
                  key={`${match.ids.openalex ?? match.ids.semanticScholar ?? index}`}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{match.displayName}</span>
                      {match.ids.orcid && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          ORCID
                        </Badge>
                      )}
                    </div>

                    {match.institution && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">{match.institution}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="text-xs text-muted-foreground">
                        {formatCount(match.worksCount)} works
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {formatCount(match.citedByCount)} citations
                      </span>
                    </div>

                    {/* Available IDs */}
                    <div className="flex flex-wrap gap-1.5">
                      {match.ids.openalex && (
                        <a
                          href={`https://openalex.org/authors/${match.ids.openalex}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          OpenAlex
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {match.ids.semanticScholar && (
                        <a
                          href={`https://www.semanticscholar.org/author/${match.ids.semanticScholar}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          S2
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {match.ids.orcid && (
                        <a
                          href={`https://orcid.org/${match.ids.orcid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ORCID
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {match.ids.dblp && (
                        <a
                          href={`https://dblp.org/pid/${match.ids.dblp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          DBLP
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => handleSelectMatch(match)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Use
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasSearched && (
          <p className="text-xs text-muted-foreground text-center">
            Enter your name and click Search to find your author profiles.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
