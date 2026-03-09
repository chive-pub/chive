'use client';

import { useState, useCallback, useMemo } from 'react';
import { notFound } from 'next/navigation';
import { Building2 } from 'lucide-react';

import {
  AuthorHeader,
  AuthorHeaderSkeleton,
  AuthorStats,
  AuthorStatsSkeleton,
  AuthorEprints,
  AuthorEprintsSkeleton,
} from '@/components/eprints';
import { AuthorEndorsements } from '@/components/authors/author-endorsements';
import { AuthorReviews } from '@/components/authors/author-reviews';
import { AuthorCollections } from '@/components/authors/author-collections';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthor } from '@/lib/hooks/use-author';
import { useProfileConfig, type ProfileSection } from '@/lib/hooks/use-profile-config';
import { useIsAuthenticated, useCurrentUser, useAgent } from '@/lib/auth';
import { ShareMenu, ShareToBlueskyDialog } from '@/components/share';
import { AddToCollectionButton } from '@/components/collection/add-to-collection-button';
import { MuteButton } from '@/components/authors/mute-button';
import { createBlueskyPost, type ShareContent } from '@/lib/bluesky';
import { cn } from '@/lib/utils';

/**
 * Props for the AuthorPageContent component.
 */
export interface AuthorPageContentProps {
  /** Author's DID */
  did: string;
}

// =============================================================================
// DEFAULT SECTION CONFIGURATION
// =============================================================================

/**
 * Default section order for individual profiles.
 */
const DEFAULT_INDIVIDUAL_SECTIONS: ProfileSection[] = [
  { id: 'eprints', visible: true, order: 0 },
  { id: 'reviews', visible: true, order: 1 },
  { id: 'endorsements', visible: true, order: 2 },
  { id: 'collections', visible: true, order: 3 },
  { id: 'proposals', visible: true, order: 4 },
];

/**
 * Default section order for organization profiles.
 */
const DEFAULT_ORGANIZATION_SECTIONS: ProfileSection[] = [
  { id: 'collections', visible: true, order: 0 },
  { id: 'eprints', visible: true, order: 1 },
  { id: 'endorsements', visible: true, order: 2 },
  { id: 'reviews', visible: true, order: 3 },
  { id: 'proposals', visible: true, order: 4 },
];

/**
 * Section labels for display in tabs.
 */
const SECTION_LABELS: Record<string, string> = {
  collections: 'Collections',
  eprints: 'Eprints',
  reviews: 'Reviews',
  endorsements: 'Endorsements',
  proposals: 'Proposals',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Client-side author page content.
 *
 * @remarks
 * Fetches and displays author profile, stats, and eprints.
 * Renders sections in the order configured by the profile owner.
 * Handles loading, error, and not found states.
 *
 * @param props - Component props
 * @returns React element with author profile content
 */
export function AuthorPageContent({ did }: AuthorPageContentProps) {
  const { data, isLoading, error } = useAuthor(did);
  const { data: profileConfig } = useProfileConfig(did);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Auth state
  const isAuthenticated = useIsAuthenticated();
  const currentUser = useCurrentUser();
  const agent = useAgent();

  // Determine profile type and section configuration
  const profileType = profileConfig?.profileType ?? 'individual';
  const isOrganization = profileType === 'organization';

  const sections = useMemo(() => {
    if (profileConfig?.sections && profileConfig.sections.length > 0) {
      return [...profileConfig.sections].sort((a, b) => a.order - b.order);
    }
    // Use defaults based on profile type
    return isOrganization ? DEFAULT_ORGANIZATION_SECTIONS : DEFAULT_INDIVIDUAL_SECTIONS;
  }, [profileConfig?.sections, isOrganization]);

  const visibleSections = useMemo(() => sections.filter((s) => s.visible), [sections]);

  const defaultTab = visibleSections[0]?.id ?? 'eprints';
  const featuredCollectionUri = profileConfig?.featuredCollectionUri;

  // Handle Bluesky post submission
  const handleBlueskyPost = useCallback(
    async (text: string, ogImageBlob: Uint8Array | undefined): Promise<{ rkey: string }> => {
      if (!agent || !data?.profile) {
        throw new Error('Not authenticated');
      }

      const displayName = data.profile.displayName ?? data.profile.handle ?? did;
      const result = await createBlueskyPost(agent, {
        text,
        embed: {
          uri: `${window.location.origin}/authors/${encodeURIComponent(did)}`,
          title: displayName,
          description: data.profile.bio ?? `Author profile for ${displayName} on Chive`,
          thumbBlob: ogImageBlob,
        },
      });

      return { rkey: result.rkey };
    },
    [agent, data?.profile, did]
  );

  // Build share content - use default OG image (Chive logo/branding)
  const shareContent: ShareContent | null = data?.profile
    ? {
        type: 'author',
        url: `${typeof window !== 'undefined' ? window.location.origin : ''}/authors/${encodeURIComponent(did)}`,
        title: data.profile.displayName ?? data.profile.handle ?? did,
        description: data.profile.bio ?? `Author profile on Chive`,
        ogImageUrl: '/api/og?type=default',
      }
    : null;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <AuthorHeaderSkeleton />
        <AuthorStatsSkeleton />
        <Separator />
        <div className="w-full">
          <div className="mb-6 flex gap-2">
            <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
            <div className="h-10 w-20 animate-pulse rounded-md bg-muted" />
          </div>
          <AuthorEprintsSkeleton count={5} />
        </div>
      </div>
    );
  }

  if (error) {
    // Check if it's a 404
    if (error.message.includes('not found') || error.message.includes('404')) {
      notFound();
    }

    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
        <h2 className="text-lg font-semibold text-destructive">Failed to load profile</h2>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (!data?.profile) {
    notFound();
  }

  /**
   * Renders a section's content by its ID.
   */
  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'collections':
        return (
          <AuthorCollections
            did={did}
            featuredCollectionUri={featuredCollectionUri}
            variant={isOrganization ? 'prominent' : 'compact'}
          />
        );
      case 'eprints':
        return <AuthorEprints did={did} layout="list" />;
      case 'reviews':
        return <AuthorReviews did={did} />;
      case 'endorsements':
        return <AuthorEndorsements did={did} />;
      case 'proposals':
        return (
          <div className="rounded-lg border bg-muted/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Graph proposals are not yet available on profile pages.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Organization badge (when applicable) */}
      {isOrganization && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-sm">
            <Building2 className="h-3.5 w-3.5" />
            Organization
          </Badge>
        </div>
      )}

      {/* Profile header with share button */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AuthorHeader profile={data.profile} />
        </div>
        <div className="flex items-center gap-2">
          {shareContent && (
            <ShareMenu
              content={shareContent}
              onShareToBluesky={() => {
                if (isAuthenticated) {
                  setShowShareDialog(true);
                } else {
                  window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
                }
              }}
              variant="outline"
              size="sm"
            />
          )}
          <MuteButton did={did} />
          <AddToCollectionButton
            itemUri={did}
            itemType="author"
            itemLabel={data.profile.displayName ?? data.profile.handle ?? did}
            variant="icon"
          />
        </div>
      </div>

      {/* Stats */}
      <AuthorStats metrics={data.metrics} />

      <Separator />

      {/* Featured collection (shown above tabs for organizations) */}
      {isOrganization && featuredCollectionUri && (
        <AuthorCollections
          did={did}
          featuredCollectionUri={featuredCollectionUri}
          variant="prominent"
          className={cn('pb-2')}
        />
      )}

      {/* Content tabs (ordered by profile config) */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="mb-6">
          {visibleSections.map((section) => (
            <TabsTrigger key={section.id} value={section.id}>
              {SECTION_LABELS[section.id] ?? section.id}
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleSections.map((section) => (
          <TabsContent key={section.id} value={section.id}>
            {renderSectionContent(section.id)}
          </TabsContent>
        ))}
      </Tabs>

      {/* Share to Bluesky dialog */}
      {shareContent && currentUser && (
        <ShareToBlueskyDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          content={shareContent}
          user={{
            did: currentUser.did,
            displayName: currentUser.displayName ?? currentUser.handle,
            handle: currentUser.handle,
            avatar: currentUser.avatar,
          }}
          onSubmit={handleBlueskyPost}
        />
      )}
    </div>
  );
}
