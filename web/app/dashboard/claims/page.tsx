'use client';

import { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ArrowRight,
  Filter,
  Loader2,
  ExternalLink,
  Sparkles,
  Settings,
  Info,
} from 'lucide-react';

import {
  useUserClaims,
  useEprintSearchState,
  useStartClaimFromExternal,
  usePaperSuggestions,
  type ExternalEprint,
  type ImportSource,
  type SuggestedPaper,
} from '@/lib/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { EprintSearchAutocomplete } from '@/components/search';
import type { ClaimRequestWithPaper, ClaimStatus } from '@/lib/api/schema';

// =============================================================================
// CLAIMED PAPERS CONTEXT
// =============================================================================

/**
 * Context for tracking papers that have been claimed in this session.
 *
 * @remarks
 * Since the ClaimRequest API doesn't return source/externalId, we track
 * claimed papers locally to show "Already Claimed" status on paper cards.
 */
interface ClaimedPapersContextValue {
  /** Set of claimed paper keys (format: "source:externalId") */
  claimedPapers: Set<string>;
  /** Mark a paper as claimed */
  markAsClaimed: (source: string, externalId: string) => void;
  /** Check if a paper is claimed */
  isClaimed: (source: string, externalId: string) => boolean;
}

const ClaimedPapersContext = createContext<ClaimedPapersContextValue | null>(null);

function useClaimedPapers() {
  const context = useContext(ClaimedPapersContext);
  if (!context) {
    throw new Error('useClaimedPapers must be used within ClaimedPapersProvider');
  }
  return context;
}

function ClaimedPapersProvider({ children }: { children: React.ReactNode }) {
  const [claimedPapers, setClaimedPapers] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Fetch user claims to initialize the claimed papers set
  const { data: claimsData } = useUserClaims({ enabled: true });

  // Initialize claimed papers from user's existing claims
  useEffect(() => {
    if (claimsData && !initialized) {
      const allClaims = claimsData.pages.flatMap((p) => p.claims);
      const claimedKeys = new Set<string>();
      for (const claim of allClaims) {
        if (claim.paper) {
          claimedKeys.add(`${claim.paper.source}:${claim.paper.externalId}`);
        }
      }
      if (claimedKeys.size > 0) {
        setClaimedPapers(claimedKeys);
      }
      setInitialized(true);
    }
  }, [claimsData, initialized]);

  const markAsClaimed = useCallback((source: string, externalId: string) => {
    const key = `${source}:${externalId}`;
    setClaimedPapers((prev) => new Set(prev).add(key));
  }, []);

  const isClaimed = useCallback(
    (source: string, externalId: string) => {
      const key = `${source}:${externalId}`;
      return claimedPapers.has(key);
    },
    [claimedPapers]
  );

  const value = useMemo(
    () => ({ claimedPapers, markAsClaimed, isClaimed }),
    [claimedPapers, markAsClaimed, isClaimed]
  );

  return <ClaimedPapersContext.Provider value={value}>{children}</ClaimedPapersContext.Provider>;
}

/**
 * Claims dashboard page.
 *
 * @remarks
 * Allows users to search for claimable eprints and manage their claims.
 */
export default function ClaimsPage() {
  return (
    <ClaimedPapersProvider>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Claim Eprints</h1>
          <p className="text-muted-foreground">
            Claim ownership of your eprints from external repositories like arXiv, bioRxiv, and
            more
          </p>
        </div>

        <Tabs defaultValue="suggestions" className="space-y-6">
          <TabsList>
            <TabsTrigger value="suggestions" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Suggested For You
            </TabsTrigger>
            <TabsTrigger value="search">Find Claimable</TabsTrigger>
            <TabsTrigger value="my-claims">My Claims</TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="space-y-6">
            <PaperSuggestions />
          </TabsContent>

          <TabsContent value="search" className="space-y-6">
            <ClaimableSearch />
          </TabsContent>

          <TabsContent value="my-claims" className="space-y-6">
            <UserClaims />
          </TabsContent>
        </Tabs>
      </div>
    </ClaimedPapersProvider>
  );
}

/**
 * Auto-suggestions based on user's Chive profile.
 *
 * @remarks
 * Shows papers that match the user's profile (name variants, ORCID, affiliations).
 * Requires the user to have set up their Chive academic profile.
 */
function PaperSuggestions() {
  const { data, isLoading, isError, error, refetch } = usePaperSuggestions({ limit: 20 });

  // Empty profile state
  if (
    !isLoading &&
    data &&
    !data.profileUsed.displayName &&
    data.profileUsed.nameVariants.length === 0 &&
    !data.profileUsed.hasOrcid &&
    !data.profileUsed.hasExternalIds
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Set Up Your Profile
          </CardTitle>
          <CardDescription>
            Add your name variants and academic identifiers to get personalized paper suggestions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To receive paper suggestions, please complete your Chive academic profile with:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Your display name and name variants (e.g., &quot;J. Smith&quot;, maiden names)</li>
            <li>ORCID identifier for verified paper matching</li>
            <li>Current and previous affiliations</li>
            <li>Research keywords for better matching</li>
          </ul>
          <Button asChild>
            <Link href="/dashboard/settings">
              <Settings className="mr-2 h-4 w-4" />
              Go to Profile Settings
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <>
        <ProfileInfoCard profileUsed={null} isLoading />
        <div className="space-y-4">
          <ExternalEprintCardSkeleton />
          <ExternalEprintCardSkeleton />
          <ExternalEprintCardSkeleton />
        </div>
      </>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
          <p className="text-destructive mt-4">Failed to load suggestions</p>
          <p className="text-sm text-muted-foreground mt-2">
            {error?.message ?? 'Please try again later'}
          </p>
          <Button variant="outline" onClick={() => refetch()} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No suggestions found
  if (!data?.papers || data.papers.length === 0) {
    return (
      <>
        <ProfileInfoCard profileUsed={data?.profileUsed ?? null} />
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground mt-4">No suggested papers found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Try adding more name variants or linking your ORCID in your profile settings
            </p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/settings">Update Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  // Show suggestions
  return (
    <>
      <ProfileInfoCard profileUsed={data.profileUsed} />
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Found {data.papers.length} paper{data.papers.length !== 1 ? 's' : ''} that may be yours
        </p>
        {data.papers.map((paper) => (
          <SuggestedPaperCard key={`${paper.source}:${paper.externalId}`} paper={paper} />
        ))}
      </div>
    </>
  );
}

/**
 * Shows profile info used for suggestions.
 */
function ProfileInfoCard({
  profileUsed,
  isLoading,
}: {
  profileUsed: {
    displayName?: string;
    nameVariants: string[];
    hasOrcid: boolean;
    hasExternalIds: boolean;
  } | null;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profileUsed) return null;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">
                Searching for papers by{' '}
                {profileUsed.displayName || profileUsed.nameVariants[0] || 'you'}
              </p>
              {profileUsed.hasOrcid && (
                <Badge variant="outline" className="text-xs">
                  ORCID Linked
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {profileUsed.nameVariants.length > 0 && (
                <span>Name variants: {profileUsed.nameVariants.slice(0, 3).join(', ')}</span>
              )}
              {profileUsed.nameVariants.length > 3 && (
                <span> +{profileUsed.nameVariants.length - 3} more</span>
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Card for a suggested paper with match score.
 */
function SuggestedPaperCard({ paper }: { paper: SuggestedPaper }) {
  const { isClaimed, markAsClaimed } = useClaimedPapers();
  const startClaim = useStartClaimFromExternal();

  const alreadyClaimed = isClaimed(paper.source, paper.externalId);

  const handleClaim = () => {
    startClaim.mutate(
      {
        source: paper.source as ImportSource,
        externalId: paper.externalId,
      },
      {
        onSuccess: () => {
          markAsClaimed(paper.source, paper.externalId);
        },
      }
    );
  };

  // Format author names
  const authorNames = paper.authors.map((a) => a.name);
  const displayAuthors = authorNames.slice(0, 3).join(', ');
  const additionalAuthors = authorNames.length > 3 ? ` +${authorNames.length - 3} more` : '';

  // Match score color
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-muted-foreground bg-muted/50';
  };

  return (
    <Card className={alreadyClaimed ? 'opacity-75' : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-lg line-clamp-2">{paper.title}</CardTitle>
            <CardDescription className="line-clamp-1">
              {displayAuthors}
              {additionalAuthors}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge variant="secondary">{getSourceDisplayName(paper.source as ImportSource)}</Badge>
            {alreadyClaimed ? (
              <Badge variant="outline" className="text-xs font-medium text-green-600 bg-green-50">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Claimed
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={`text-xs font-medium ${getScoreColor(paper.matchScore)}`}
              >
                {paper.matchScore}% match
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Match reason */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{paper.matchReason}</span>
        </div>

        {/* Abstract preview */}
        {paper.abstract && (
          <p className="text-sm text-muted-foreground line-clamp-2">{paper.abstract}</p>
        )}

        {/* Metadata and actions */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {paper.doi && <span className="font-mono text-xs">DOI: {paper.doi}</span>}
            {paper.publicationDate && (
              <span>Published: {new Date(paper.publicationDate).toLocaleDateString()}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {paper.url && (
              <Button variant="outline" size="sm" asChild>
                <a href={paper.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View
                </a>
              </Button>
            )}
            {alreadyClaimed ? (
              <Button variant="outline" disabled>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                Already Claimed
              </Button>
            ) : (
              <Button onClick={handleClaim} disabled={startClaim.isPending}>
                {startClaim.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  <>
                    Claim Paper <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Success message */}
        {alreadyClaimed && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              Claim started! Go to{' '}
              <Link href="/dashboard/claims" className="underline font-medium">
                My Claims
              </Link>{' '}
              to continue verification.
            </span>
          </div>
        )}

        {/* Error message */}
        {startClaim.isError && !alreadyClaimed && (
          <p className="text-sm text-destructive">
            Failed to start claim: {startClaim.error.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Available import sources for filtering.
 */
const AVAILABLE_SOURCES: { id: ImportSource; label: string }[] = [
  { id: 'arxiv', label: 'arXiv' },
  { id: 'openreview', label: 'OpenReview' },
  { id: 'psyarxiv', label: 'PsyArXiv' },
  { id: 'lingbuzz', label: 'LingBuzz' },
  { id: 'semanticsarchive', label: 'Semantics Archive' },
];

/**
 * Get display name for source.
 */
function getSourceDisplayName(source: ImportSource): string {
  const found = AVAILABLE_SOURCES.find((s) => s.id === source);
  return found?.label ?? source;
}

/**
 * Search for claimable eprints in external repositories.
 *
 * @remarks
 * Uses federated search across multiple external sources:
 * - arXiv, OpenReview, PsyArXiv: Real-time API search
 * - LingBuzz, Semantics Archive: Local index search
 *
 * Implements progressive disclosure pattern:
 * - Simple search bar by default
 * - Advanced filters collapsed until needed
 */
function ClaimableSearch() {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const {
    query,
    setQuery,
    submittedQuery,
    selectedSources,
    suggestions,
    searchResults,
    availableSources,
    isAutocompleteLoading,
    isSearchLoading,
    isSearchFetching,
    handleSubmit,
    handleSelectSuggestion,
    toggleSource,
  } = useEprintSearchState();

  return (
    <>
      {/* Search card with autocomplete */}
      <Card>
        <CardHeader>
          <CardTitle>Search External Repositories</CardTitle>
          <CardDescription>
            Search for your papers across arXiv, OpenReview, PsyArXiv, LingBuzz, and more
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Autocomplete search input */}
          <div className="flex gap-2">
            <div className="flex-1">
              <EprintSearchAutocomplete
                value={query}
                onChange={setQuery}
                onSubmit={handleSubmit}
                onSelectSuggestion={handleSelectSuggestion}
                suggestions={suggestions}
                isLoading={isAutocompleteLoading}
                placeholder="Search by title, author name, or arXiv ID..."
                autoFocus
              />
            </div>
            <Button type="button" onClick={() => handleSubmit()} disabled={!query.trim()}>
              Search
            </Button>
          </div>

          {/* Advanced filters (progressive disclosure) */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                {advancedOpen ? 'Hide' : 'Show'} advanced options
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Filter by source</Label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {AVAILABLE_SOURCES.map((source) => (
                      <div key={source.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`source-${source.id}`}
                          checked={selectedSources.includes(source.id)}
                          onCheckedChange={() => toggleSource(source.id)}
                        />
                        <Label
                          htmlFor={`source-${source.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {source.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedSources.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Filtering to:{' '}
                      {selectedSources
                        .map((s) => getSourceDisplayName(s as ImportSource))
                        .join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Search results with facets */}
      {submittedQuery && (
        <div className="space-y-4">
          {/* Source facets (when results available) */}
          {availableSources.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableSources.map(({ source, count }) => (
                <Badge
                  key={source}
                  variant={selectedSources.includes(source as ImportSource) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleSource(source)}
                >
                  {getSourceDisplayName(source as ImportSource)} ({count})
                </Badge>
              ))}
            </div>
          )}

          {/* Loading state */}
          {isSearchLoading ? (
            <>
              <ExternalEprintCardSkeleton />
              <ExternalEprintCardSkeleton />
              <ExternalEprintCardSkeleton />
            </>
          ) : searchResults.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground mt-4">
                  No eprints found for &ldquo;{submittedQuery}&rdquo;
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try searching with different keywords or check your spelling
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Result count with loading indicator */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Found {searchResults.length} eprint{searchResults.length !== 1 ? 's' : ''}
                </p>
                {isSearchFetching && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Refreshing...
                  </div>
                )}
              </div>

              {/* Results */}
              {searchResults.map((eprint) => (
                <ExternalEprintCard
                  key={`${eprint.source}:${eprint.externalId}`}
                  eprint={eprint}
                />
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Card for an external eprint from federated search.
 */
function ExternalEprintCard({ eprint }: { eprint: ExternalEprint }) {
  const { isClaimed, markAsClaimed } = useClaimedPapers();
  const startClaim = useStartClaimFromExternal();

  const alreadyClaimed = isClaimed(eprint.source, eprint.externalId);

  const handleClaim = () => {
    startClaim.mutate(
      {
        source: eprint.source,
        externalId: eprint.externalId,
      },
      {
        onSuccess: () => {
          markAsClaimed(eprint.source, eprint.externalId);
        },
      }
    );
  };

  // Format author names
  const authorNames = eprint.authors.map((a) => a.name);
  const displayAuthors = authorNames.slice(0, 3).join(', ');
  const additionalAuthors = authorNames.length > 3 ? ` +${authorNames.length - 3} more` : '';

  return (
    <Card className={alreadyClaimed ? 'opacity-75' : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-lg line-clamp-2">{eprint.title}</CardTitle>
            <CardDescription className="line-clamp-1">
              {displayAuthors}
              {additionalAuthors}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge variant="secondary">{getSourceDisplayName(eprint.source)}</Badge>
            {alreadyClaimed && (
              <Badge variant="outline" className="text-xs font-medium text-green-600 bg-green-50">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Claimed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Abstract preview */}
        {eprint.abstract && (
          <p className="text-sm text-muted-foreground line-clamp-3">{eprint.abstract}</p>
        )}

        {/* Metadata and actions */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {eprint.doi && <span className="font-mono text-xs">DOI: {eprint.doi}</span>}
            {eprint.publicationDate && (
              <span>Published: {new Date(eprint.publicationDate).toLocaleDateString()}</span>
            )}
            {eprint.categories && eprint.categories.length > 0 && (
              <div className="flex gap-1">
                {eprint.categories.slice(0, 3).map((cat) => (
                  <Badge key={cat} variant="outline" className="text-xs">
                    {cat}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {eprint.url && (
              <Button variant="outline" size="sm" asChild>
                <a href={eprint.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Source
                </a>
              </Button>
            )}
            {alreadyClaimed ? (
              <Button variant="outline" disabled>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                Already Claimed
              </Button>
            ) : (
              <Button onClick={handleClaim} disabled={startClaim.isPending}>
                {startClaim.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    Claim This Paper <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Success message */}
        {alreadyClaimed && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              Claim started! Go to{' '}
              <Link href="/dashboard/claims" className="underline font-medium">
                My Claims
              </Link>{' '}
              to continue verification.
            </span>
          </div>
        )}

        {/* Error message */}
        {startClaim.isError && !alreadyClaimed && (
          <p className="text-sm text-destructive">
            Failed to start claim: {startClaim.error.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ExternalEprintCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * List of user's claims.
 */
function UserClaims() {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useUserClaims();

  const allClaims = data?.pages.flatMap((p) => p.claims) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ClaimCardSkeleton />
        <ClaimCardSkeleton />
      </div>
    );
  }

  if (allClaims.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">You haven&apos;t claimed any eprints yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Search for your papers in the &ldquo;Find Claimable&rdquo; tab to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {allClaims.map((claim) => (
        <ClaimCard key={claim.id} claim={claim} />
      ))}
      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Card for displaying a claim with full paper details.
 */
function ClaimCard({ claim }: { claim: ClaimRequestWithPaper }) {
  const statusConfig = getStatusConfig(claim.status);
  const paper = claim.paper;

  // Format author names
  const authorNames = paper.authors.map((a) => a.name);
  const displayAuthors = authorNames.slice(0, 3).join(', ');
  const additionalAuthors = authorNames.length > 3 ? ` +${authorNames.length - 3} more` : '';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-lg line-clamp-2">{paper.title}</CardTitle>
            <CardDescription className="line-clamp-1">
              {displayAuthors}
              {additionalAuthors}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge variant="secondary">{getSourceDisplayName(paper.source as ImportSource)}</Badge>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status description */}
        <div className="flex items-center gap-2">
          <statusConfig.icon className={`h-4 w-4 ${statusConfig.color}`} />
          <span className="text-sm">{statusConfig.description}</span>
        </div>

        {/* Paper metadata */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          {paper.doi && <span className="font-mono text-xs">DOI: {paper.doi}</span>}
          {paper.publicationDate && (
            <span>Published: {new Date(paper.publicationDate).toLocaleDateString()}</span>
          )}
          <span>Claimed: {new Date(claim.createdAt).toLocaleDateString()}</span>
        </div>

        {/* Evidence section */}
        {claim.evidence.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Verification Evidence</p>
            <div className="flex flex-wrap gap-2">
              {claim.evidence.map((e, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {e.type}: {Math.round(e.score * 100)}%
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Overall score: {Math.round(claim.verificationScore * 100)}%
            </p>
          </div>
        )}

        {/* Rejection reason */}
        {claim.rejectionReason && (
          <div className="bg-destructive/10 p-3 rounded-md">
            <p className="text-sm font-medium text-destructive">Rejection Reason</p>
            <p className="text-sm">{claim.rejectionReason}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {paper.externalUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={paper.externalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Source
              </a>
            </Button>
          )}

          {claim.canonicalUri && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/eprints/${encodeURIComponent(claim.canonicalUri)}`}>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                View on Chive
              </Link>
            </Button>
          )}

          {claim.status === 'pending' && claim.evidence.length === 0 && (
            <Button asChild>
              <Link href={`/dashboard/claims/${claim.id}`}>
                Continue Verification <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ClaimCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between">
          <div>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-24 mt-2" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4 mt-2" />
      </CardContent>
    </Card>
  );
}

/**
 * Get status display configuration.
 */
function getStatusConfig(status: ClaimStatus): {
  label: string;
  description: string;
  icon: typeof CheckCircle2;
  color: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  switch (status) {
    case 'approved':
      return {
        label: 'Approved',
        description: 'Your claim has been verified and approved',
        icon: CheckCircle2,
        color: 'text-green-500',
        variant: 'default',
      };
    case 'pending':
      return {
        label: 'Pending',
        description: 'Awaiting verification or admin review',
        icon: Clock,
        color: 'text-yellow-500',
        variant: 'secondary',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        description: 'Your claim was rejected',
        icon: XCircle,
        color: 'text-destructive',
        variant: 'destructive',
      };
    case 'expired':
      return {
        label: 'Expired',
        description: 'Claim expired before completion',
        icon: AlertCircle,
        color: 'text-muted-foreground',
        variant: 'outline',
      };
  }
}
