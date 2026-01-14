'use client';

import { useState, useCallback } from 'react';
import { notFound } from 'next/navigation';

import { ThumbsUp } from 'lucide-react';
import {
  AuthorHeader,
  AuthorHeaderSkeleton,
  AuthorStats,
  AuthorStatsSkeleton,
  AuthorEprints,
  AuthorEprintsSkeleton,
} from '@/components/eprints';
import { AuthorReviews } from '@/components/authors/author-reviews';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthor } from '@/lib/hooks/use-author';
import { useIsAuthenticated, useCurrentUser, useAgent } from '@/lib/auth';
import { ShareMenu, ShareToBlueskyDialog } from '@/components/share';
import { createBlueskyPost, type ShareContent } from '@/lib/bluesky';

/**
 * Props for the AuthorPageContent component.
 */
export interface AuthorPageContentProps {
  /** Author's DID */
  did: string;
}

/**
 * Placeholder component for author endorsements.
 *
 * @remarks
 * Shows total endorsements received until a dedicated API endpoint
 * for listing endorsements by author is available.
 */
function AuthorEndorsementsPlaceholder({ totalEndorsements }: { totalEndorsements: number }) {
  if (totalEndorsements === 0) {
    return (
      <div className="rounded-lg border bg-muted/50 p-8 text-center">
        <ThumbsUp className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 font-medium">No endorsements yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This author&apos;s eprints haven&apos;t received any endorsements.
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <ThumbsUp className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-3xl font-bold">{totalEndorsements}</p>
            <p className="text-muted-foreground">Total endorsements received across all eprints</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Detailed endorsement listings for each eprint are available on the individual eprint
          pages.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Client-side author page content.
 *
 * @remarks
 * Fetches and displays author profile, stats, and eprints.
 * Handles loading, error, and not found states.
 *
 * @param props - Component props
 * @returns React element with author profile content
 */
export function AuthorPageContent({ did }: AuthorPageContentProps) {
  const { data, isLoading, error } = useAuthor(did);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Auth state
  const isAuthenticated = useIsAuthenticated();
  const currentUser = useCurrentUser();
  const agent = useAgent();

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

  // Build share content
  const shareContent: ShareContent | null = data?.profile
    ? {
        type: 'author',
        url: `${typeof window !== 'undefined' ? window.location.origin : ''}/authors/${encodeURIComponent(did)}`,
        title: data.profile.displayName ?? data.profile.handle ?? did,
        description: data.profile.bio ?? `Author profile on Chive`,
        ogImageUrl: `/api/og?type=author&did=${encodeURIComponent(did)}&name=${encodeURIComponent((data.profile.displayName ?? data.profile.handle ?? did).slice(0, 100))}&handle=${encodeURIComponent(data.profile.handle ?? '')}&bio=${encodeURIComponent((data.profile.bio ?? '').slice(0, 200))}&affiliation=${encodeURIComponent(data.profile.affiliation ?? '')}${data.profile.avatar ? `&avatar=${encodeURIComponent(data.profile.avatar)}` : ''}`,
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

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-8">
      {/* Profile header with share button */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AuthorHeader profile={data.profile} />
        </div>
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
      </div>

      {/* Stats */}
      <AuthorStats metrics={data.metrics} />

      <Separator />

      {/* Content tabs */}
      <Tabs defaultValue="eprints" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="eprints">Eprints</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="endorsements">Endorsements</TabsTrigger>
        </TabsList>

        <TabsContent value="eprints">
          <AuthorEprints did={did} layout="list" />
        </TabsContent>

        <TabsContent value="reviews">
          <AuthorReviews did={did} />
        </TabsContent>

        <TabsContent value="endorsements">
          <AuthorEndorsementsPlaceholder totalEndorsements={data.metrics.totalEndorsements} />
        </TabsContent>
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
