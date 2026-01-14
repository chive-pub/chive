import { ExternalLink, Globe, Building2, Tag, GraduationCap, BookOpen, Users } from 'lucide-react';

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { OrcidBadge } from './orcid-badge';
import { cn } from '@/lib/utils';
import type { AuthorProfile } from '@/lib/api/schema';

/**
 * Props for the AuthorHeader component.
 */
export interface AuthorHeaderProps {
  /** Author profile data */
  profile: AuthorProfile;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays the header section of an author profile page.
 *
 * @remarks
 * Server component that renders author avatar, name, bio, and links.
 * Shows ORCID badge and affiliation when available.
 *
 * @example
 * ```tsx
 * <AuthorHeader profile={authorProfile} />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the author header
 */
export function AuthorHeader({ profile, className }: AuthorHeaderProps) {
  const displayName = profile.displayName ?? profile.handle ?? profile.did;
  const initials = getInitials(displayName);

  // Type-safe access to extended profile fields
  const extendedProfile = profile as AuthorProfile & {
    affiliations?: Array<{ name: string; rorId?: string }>;
    previousAffiliations?: Array<{ name: string; rorId?: string }>;
    researchKeywords?: Array<{ label: string; fastId?: string; wikidataId?: string }>;
    nameVariants?: string[];
    semanticScholarId?: string;
    openAlexId?: string;
    googleScholarId?: string;
    arxivAuthorId?: string;
    openReviewId?: string;
    dblpId?: string;
    scopusAuthorId?: string;
  };

  const hasAffiliations = extendedProfile.affiliations && extendedProfile.affiliations.length > 0;
  const hasPreviousAffiliations =
    extendedProfile.previousAffiliations && extendedProfile.previousAffiliations.length > 0;
  const hasResearchKeywords =
    extendedProfile.researchKeywords && extendedProfile.researchKeywords.length > 0;
  const hasNameVariants = extendedProfile.nameVariants && extendedProfile.nameVariants.length > 0;
  const hasExternalIds =
    extendedProfile.semanticScholarId ||
    extendedProfile.openAlexId ||
    extendedProfile.googleScholarId ||
    extendedProfile.arxivAuthorId ||
    extendedProfile.openReviewId ||
    extendedProfile.dblpId ||
    extendedProfile.scopusAuthorId;

  return (
    <header className={cn('space-y-6', className)}>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {/* Avatar */}
        <Avatar className="h-24 w-24 sm:h-32 sm:w-32">
          {profile.avatar ? <AvatarImage src={profile.avatar} alt={displayName} /> : null}
          <AvatarFallback className="text-2xl sm:text-3xl">{initials}</AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>

          {/* Handle */}
          {profile.handle && (
            <p className="mt-1 text-lg text-muted-foreground">@{profile.handle}</p>
          )}

          {/* Name variants */}
          {hasNameVariants && (
            <p className="mt-1 text-sm text-muted-foreground">
              Also known as: {extendedProfile.nameVariants!.join(', ')}
            </p>
          )}

          {/* Affiliations */}
          {hasAffiliations && (
            <div className="mt-3 space-y-1">
              {extendedProfile.affiliations!.map((aff, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-center gap-2 text-muted-foreground sm:justify-start"
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  {aff.rorId ? (
                    <a
                      href={`https://ror.org/${aff.rorId.replace('https://ror.org/', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground hover:underline"
                    >
                      {aff.name}
                    </a>
                  ) : (
                    <span>{aff.name}</span>
                  )}
                  {idx === 0 && (
                    <Badge variant="outline" className="text-xs">
                      Primary
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Fallback to single affiliation if no affiliations array */}
          {!hasAffiliations && profile.affiliation && (
            <div className="mt-2 flex items-center justify-center gap-2 text-muted-foreground sm:justify-start">
              <Building2 className="h-4 w-4" />
              <span>{profile.affiliation}</span>
            </div>
          )}

          {/* Bio */}
          {profile.bio && <p className="mt-4 max-w-2xl text-muted-foreground">{profile.bio}</p>}

          {/* Primary links row */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
            {profile.orcid && <OrcidBadge orcid={profile.orcid} />}

            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Globe className="h-4 w-4" />
                Website
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            <a
              href={profile.pdsEndpoint}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              PDS: {formatPdsHost(profile.pdsEndpoint)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Research keywords */}
      {hasResearchKeywords && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Tag className="h-4 w-4" />
            Research Interests
          </div>
          <div className="flex flex-wrap gap-2">
            <TooltipProvider>
              {extendedProfile.researchKeywords!.map((keyword, idx) => (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="cursor-default">
                      {keyword.label}
                    </Badge>
                  </TooltipTrigger>
                  {(keyword.fastId || keyword.wikidataId) && (
                    <TooltipContent>
                      <div className="text-xs">
                        {keyword.fastId && <p>FAST: {keyword.fastId}</p>}
                        {keyword.wikidataId && <p>Wikidata: {keyword.wikidataId}</p>}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </div>
      )}

      {/* External Authority IDs */}
      {hasExternalIds && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="h-4 w-4" />
            Academic Profiles
          </div>
          <div className="flex flex-wrap gap-3">
            {extendedProfile.semanticScholarId && (
              <a
                href={`https://www.semanticscholar.org/author/${extendedProfile.semanticScholarId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Semantic Scholar
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {extendedProfile.openAlexId && (
              <a
                href={`https://openalex.org/authors/${extendedProfile.openAlexId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                OpenAlex
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {extendedProfile.googleScholarId && (
              <a
                href={`https://scholar.google.com/citations?user=${extendedProfile.googleScholarId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Google Scholar
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {extendedProfile.dblpId && (
              <a
                href={`https://dblp.org/pid/${extendedProfile.dblpId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                DBLP
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {extendedProfile.openReviewId && (
              <a
                href={`https://openreview.net/profile?id=${encodeURIComponent(extendedProfile.openReviewId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                OpenReview
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {extendedProfile.scopusAuthorId && (
              <a
                href={`https://www.scopus.com/authid/detail.uri?authorId=${extendedProfile.scopusAuthorId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Scopus
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {extendedProfile.arxivAuthorId && (
              <a
                href={`https://arxiv.org/a/${extendedProfile.arxivAuthorId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                arXiv
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Previous affiliations */}
      {hasPreviousAffiliations && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <GraduationCap className="h-4 w-4" />
            Previous Affiliations
          </div>
          <div className="flex flex-wrap gap-2">
            {extendedProfile.previousAffiliations!.map((aff, idx) => (
              <Badge key={idx} variant="outline" className="text-muted-foreground">
                {aff.rorId ? (
                  <a
                    href={`https://ror.org/${aff.rorId.replace('https://ror.org/', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground"
                  >
                    {aff.name}
                  </a>
                ) : (
                  aff.name
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

/**
 * Props for the AuthorHeaderSkeleton component.
 */
export interface AuthorHeaderSkeletonProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for the AuthorHeader component.
 */
export function AuthorHeaderSkeleton({ className }: AuthorHeaderSkeletonProps) {
  return (
    <header className={cn('space-y-6', className)}>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {/* Avatar skeleton */}
        <div className="h-24 w-24 animate-pulse rounded-full bg-muted sm:h-32 sm:w-32" />

        {/* Info skeleton */}
        <div className="flex-1 text-center sm:text-left">
          <div className="mx-auto h-9 w-48 animate-pulse rounded bg-muted sm:mx-0" />
          <div className="mx-auto mt-2 h-5 w-32 animate-pulse rounded bg-muted sm:mx-0" />
          <div className="mx-auto mt-4 h-4 w-40 animate-pulse rounded bg-muted sm:mx-0" />
          <div className="mx-auto mt-4 space-y-2 sm:mx-0">
            <div className="h-4 w-full max-w-md animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/4 max-w-md animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-4 sm:justify-start">
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="h-6 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Gets initials from a display name.
 */
function getInitials(name: string): string {
  const parts = name.split(/[\s.-]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Extracts hostname from PDS URL.
 */
function formatPdsHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
