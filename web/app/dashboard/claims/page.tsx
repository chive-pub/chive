'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  Clock,
  ArrowRight,
  Filter,
  Loader2,
  ExternalLink,
  Sparkles,
  Settings,
  Info,
  AlertCircle,
} from 'lucide-react';

import {
  useEprintSearchState,
  usePaperSuggestions,
  useMyCoauthorRequests,
  type ExternalEprint,
  type ImportSource,
  type SuggestedPaper,
  type SuggestedPaperAuthor,
} from '@/lib/hooks';
import type { CoauthorClaimRequest } from '@/lib/api/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { EprintSearchAutocomplete } from '@/components/search';

/**
 * Claims dashboard page.
 *
 * @remarks
 * Allows users to search for claimable eprints and manage their claims.
 */
export default function ClaimsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'my-claims' || tabParam === 'search' ? tabParam : 'suggestions';

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'suggestions') {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }
    router.push(`/dashboard/claims${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Your Papers</h1>
        <p className="text-muted-foreground">
          Import your papers from external repositories like arXiv, bioRxiv, and more to your Chive
          PDS
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="suggestions">Suggested For You</TabsTrigger>
          <TabsTrigger value="search">Search External</TabsTrigger>
          <TabsTrigger value="my-claims">My Claims</TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="space-y-6">
          <PaperSuggestions />
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <ClaimableSearch />
        </TabsContent>

        <TabsContent value="my-claims" className="space-y-6">
          <CoAuthorClaims />
        </TabsContent>
      </Tabs>
    </div>
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
  const router = useRouter();

  const handleClaim = () => {
    router.push(`/submit/claim/${paper.source}/${encodeURIComponent(paper.externalId)}`);
  };

  // Format author names
  const authorNames = paper.authors.map((a: SuggestedPaperAuthor) => a.name);
  const displayAuthors = authorNames.slice(0, 3).join(', ');
  const additionalAuthors = authorNames.length > 3 ? ` +${authorNames.length - 3} more` : '';

  // Match score color
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-muted-foreground bg-muted/50';
  };

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
            <Badge
              variant="outline"
              className={`text-xs font-medium ${getScoreColor(paper.matchScore)}`}
            >
              {paper.matchScore}% match
            </Badge>
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
            <Button onClick={handleClaim}>
              Import Paper <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
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
                <ExternalEprintCard key={`${eprint.source}:${eprint.externalId}`} eprint={eprint} />
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
  const router = useRouter();

  const handleClaim = () => {
    router.push(`/submit/claim/${eprint.source}/${encodeURIComponent(eprint.externalId)}`);
  };

  // Format author names
  const authorNames = eprint.authors.map((a) => a.name);
  const displayAuthors = authorNames.slice(0, 3).join(', ');
  const additionalAuthors = authorNames.length > 3 ? ` +${authorNames.length - 3} more` : '';

  return (
    <Card>
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
            <Button onClick={handleClaim}>
              Import This Paper <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
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
 * Co-author claims on papers already on Chive.
 *
 * Shows pending requests to be added as co-author to papers in other users' PDSes.
 */
function CoAuthorClaims() {
  const { data, isLoading, isError, error, refetch } = useMyCoauthorRequests();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CoauthorRequestSkeleton />
        <CoauthorRequestSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
          <p className="text-destructive mt-4">Failed to load co-author requests</p>
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

  if (!data?.requests || data.requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Co-Author Requests</CardTitle>
          <CardDescription>
            Request to be added as a co-author to papers that are already on Chive
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground mt-4">No pending co-author requests</p>
          <p className="text-sm text-muted-foreground mt-2">
            When you find a paper on Chive that you co-authored, you can request to be added as a
            co-author. The paper owner will receive a notification to approve your request.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Co-Author Requests</CardTitle>
          <CardDescription>
            Your pending requests to be added as co-author to papers on Chive
          </CardDescription>
        </CardHeader>
      </Card>
      {data.requests.map((request) => (
        <CoauthorRequestCard key={request.id} request={request as CoauthorClaimRequest} />
      ))}
    </div>
  );
}

/**
 * Card displaying a co-author request.
 */
function CoauthorRequestCard({ request }: { request: CoauthorClaimRequest }) {
  const getStatusBadge = () => {
    switch (request.status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'approved':
        return (
          <Badge variant="default" className="bg-green-600">
            Approved
          </Badge>
        );
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Claiming authorship as: {request.authorName}</p>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-muted-foreground truncate">Paper: {request.eprintUri}</p>
            {request.message && <p className="text-sm text-muted-foreground">{request.message}</p>}
            {request.status === 'rejected' && request.rejectionReason && (
              <p className="text-sm text-destructive">
                Rejection reason: {request.rejectionReason}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Requested: {new Date(request.createdAt).toLocaleDateString()}
              {request.reviewedAt && (
                <span> • Reviewed: {new Date(request.reviewedAt).toLocaleDateString()}</span>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/eprints/${encodeURIComponent(request.eprintUri)}`}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Paper
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CoauthorRequestSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}
