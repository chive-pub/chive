'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';

import {
  PreprintHeader,
  PreprintHeaderSkeleton,
  PreprintAbstract,
  PreprintMetadata,
  PreprintSource,
  PreprintVersionSelector,
  PreprintVersionTimeline,
  PDFDownloadButton,
  AnnotatedPDFViewerSkeleton,
} from '@/components/preprints';

// Dynamic import to prevent SSR issues with pdfjs-dist browser globals
const AnnotatedPDFViewer = dynamic(
  () => import('@/components/preprints/pdf-viewer-annotated').then((mod) => mod.AnnotatedPDFViewer),
  {
    ssr: false,
    loading: () => <AnnotatedPDFViewerSkeleton className="min-h-[600px]" />,
  }
);
import { AnnotationSidebar, EntityLinkDialog } from '@/components/annotations';
import type { TextSpanTarget } from '@/lib/api/schema';
import {
  ReviewList,
  ReviewListSkeleton,
  ReviewForm,
  type ReviewFormData,
} from '@/components/reviews';
import {
  EndorsementPanel,
  EndorsementForm,
  type EndorsementFormData,
} from '@/components/endorsements';
import { LoginPrompt } from '@/components/auth';
import { TagManager } from '@/components/tags';
import { IntegrationPanel } from '@/components/integrations';
import { RelatedPapersPanel } from '@/components/discovery';
import { BacklinksPanel } from '@/components/backlinks';
import { EnrichmentPanel } from '@/components/enrichment';
import { ThumbsUp, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { usePreprint } from '@/lib/hooks/use-preprint';
import { useReviews, useCreateReview } from '@/lib/hooks/use-review';
import {
  useEndorsementSummary,
  useUserEndorsement,
  useCreateEndorsement,
} from '@/lib/hooks/use-endorsement';
import { useIsAuthenticated, useCurrentUser, useAgent } from '@/lib/auth';
import type { Review, Endorsement } from '@/lib/api/schema';
import { ShareMenu, ShareToBlueskyDialog } from '@/components/share';
import { createBlueskyPost, type ShareContent } from '@/lib/bluesky';

/**
 * Props for the PreprintDetailContent component.
 */
export interface PreprintDetailContentProps {
  /** Preprint AT URI */
  uri: string;
}

/**
 * Client-side preprint detail content.
 *
 * @remarks
 * Fetches and displays full preprint details including header,
 * abstract, metadata, PDF viewer, and version history.
 *
 * @param props - Component props
 * @returns React element with preprint detail content
 */
export function PreprintDetailContent({ uri }: PreprintDetailContentProps) {
  const { data: preprint, isLoading, error } = usePreprint(uri);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Review | null>(null);
  const [showEndorsementForm, setShowEndorsementForm] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Review/endorsement sharing state
  const [reviewToShare, setReviewToShare] = useState<Review | null>(null);
  const [endorsementToShare, setEndorsementToShare] = useState<Endorsement | null>(null);

  // Annotation state
  const [showAnnotationSidebar, setShowAnnotationSidebar] = useState(true);
  const [selectedAnnotationUri, setSelectedAnnotationUri] = useState<string | null>(null);
  const [entityLinkDialogOpen, setEntityLinkDialogOpen] = useState(false);
  const [entityLinkSelection, setEntityLinkSelection] = useState<{
    target: TextSpanTarget;
    selectedText: string;
  } | null>(null);
  const [inlineReviewTarget, setInlineReviewTarget] = useState<{
    target: TextSpanTarget;
    selectedText: string;
  } | null>(null);

  // Auth state
  const isAuthenticated = useIsAuthenticated();
  const currentUser = useCurrentUser();
  const agent = useAgent();

  // Reviews and endorsements
  const { data: reviewsData, isLoading: reviewsLoading } = useReviews(uri);
  const { data: endorsementSummary } = useEndorsementSummary(uri);
  const { data: userEndorsement } = useUserEndorsement(uri, currentUser?.did ?? '', {
    enabled: isAuthenticated,
  });
  const createReview = useCreateReview();
  const createEndorsement = useCreateEndorsement();

  // Get the selected version or latest
  const displayVersion = currentVersion ?? preprint?.versions?.length ?? 1;

  /**
   * Handle version change by updating state and triggering refetch.
   * The usePreprint hook should be called with version parameter when specified.
   */
  const handleVersionChange = useCallback((version: number) => {
    setCurrentVersion(version);
    // Version-specific data is handled via the preprint.versions array
    // Each version contains its own document BlobRef, so the PDFViewer
    // will automatically load the correct version when preprint data changes
  }, []);

  const handleReply = useCallback((review: Review) => {
    setReplyingTo(review);
    setShowReviewForm(true);
  }, []);

  const handleSubmitReview = useCallback(
    async (data: ReviewFormData) => {
      await createReview.mutateAsync({
        preprintUri: uri,
        content: data.content,
        parentReviewUri: data.parentReviewUri,
      });
      setShowReviewForm(false);
      setReplyingTo(null);
    },
    [uri, createReview]
  );

  const handleSubmitEndorsement = useCallback(
    async (data: EndorsementFormData) => {
      await createEndorsement.mutateAsync({
        preprintUri: uri,
        contributions: data.contributions,
        comment: data.comment,
      });
      setShowEndorsementForm(false);
    },
    [uri, createEndorsement]
  );

  // Annotation handlers
  const handleAnnotationSelect = useCallback((annotationUri: string) => {
    setSelectedAnnotationUri(annotationUri);
  }, []);

  const handleAddInlineReview = useCallback((target: TextSpanTarget, selectedText: string) => {
    setInlineReviewTarget({ target, selectedText });
    setShowReviewForm(true);
  }, []);

  const handleLinkEntity = useCallback((target: TextSpanTarget, selectedText: string) => {
    setEntityLinkSelection({ target, selectedText });
    setEntityLinkDialogOpen(true);
  }, []);

  const handleSubmitInlineReview = useCallback(
    async (data: ReviewFormData) => {
      await createReview.mutateAsync({
        preprintUri: uri,
        content: data.content,
        target: inlineReviewTarget?.target,
        parentReviewUri: data.parentReviewUri,
      });
      setShowReviewForm(false);
      setReplyingTo(null);
      setInlineReviewTarget(null);
    },
    [uri, createReview, inlineReviewTarget]
  );

  /**
   * Handle sidebar annotation click by updating selection state.
   * The AnnotatedPDFViewer will scroll to the annotation via scrollToAnnotationUri prop.
   */
  const handleSidebarAnnotationClick = useCallback(
    (annotationUri: string, _pageNumber?: number) => {
      setSelectedAnnotationUri(annotationUri);
      // The AnnotatedPDFViewer component automatically scrolls to the annotation
      // when scrollToAnnotationUri prop changes via its useEffect hook
    },
    []
  );

  // Handle review share button click
  const handleShareReview = useCallback((review: Review) => {
    setReviewToShare(review);
  }, []);

  // Handle endorsement share button click
  const handleShareEndorsement = useCallback((endorsement: Endorsement) => {
    setEndorsementToShare(endorsement);
  }, []);

  // Handle Bluesky post submission
  const handleBlueskyPost = useCallback(
    async (text: string, ogImageBlob: Uint8Array | undefined): Promise<{ rkey: string }> => {
      if (!agent || !preprint) {
        throw new Error('Not authenticated');
      }

      const result = await createBlueskyPost(agent, {
        text,
        embed: {
          uri: `${window.location.origin}/preprints/${encodeURIComponent(uri)}`,
          title: preprint.title,
          description: preprint.abstract.slice(0, 200),
          thumbBlob: ogImageBlob,
        },
      });

      return { rkey: result.rkey };
    },
    [agent, preprint, uri]
  );

  // Handle Bluesky post submission for reviews
  const handleBlueskyReviewPost = useCallback(
    async (text: string, ogImageBlob: Uint8Array | undefined): Promise<{ rkey: string }> => {
      if (!agent || !preprint || !reviewToShare) {
        throw new Error('Not authenticated');
      }

      const result = await createBlueskyPost(agent, {
        text,
        embed: {
          uri: `${window.location.origin}/preprints/${encodeURIComponent(uri)}#review-${encodeURIComponent(reviewToShare.uri)}`,
          title: `Review by ${reviewToShare.author.displayName || reviewToShare.author.handle}`,
          description: reviewToShare.content.slice(0, 200),
          thumbBlob: ogImageBlob,
        },
      });

      return { rkey: result.rkey };
    },
    [agent, preprint, uri, reviewToShare]
  );

  // Handle Bluesky post submission for endorsements
  const handleBlueskyEndorsementPost = useCallback(
    async (text: string, ogImageBlob: Uint8Array | undefined): Promise<{ rkey: string }> => {
      if (!agent || !preprint || !endorsementToShare) {
        throw new Error('Not authenticated');
      }

      const result = await createBlueskyPost(agent, {
        text,
        embed: {
          uri: `${window.location.origin}/preprints/${encodeURIComponent(uri)}#endorsement-${encodeURIComponent(endorsementToShare.uri)}`,
          title: `Endorsement by ${endorsementToShare.endorser.displayName || endorsementToShare.endorser.handle}`,
          description: endorsementToShare.contributions.join(', '),
          thumbBlob: ogImageBlob,
        },
      });

      return { rkey: result.rkey };
    },
    [agent, preprint, uri, endorsementToShare]
  );

  // Build share content for the dialog
  const shareContent: ShareContent | null = preprint
    ? {
        type: 'preprint',
        url: `${typeof window !== 'undefined' ? window.location.origin : ''}/preprints/${encodeURIComponent(uri)}`,
        title: preprint.title,
        description: preprint.abstract.slice(0, 200),
        ogImageUrl: `/api/og?type=preprint&uri=${encodeURIComponent(uri)}&title=${encodeURIComponent(preprint.title.slice(0, 200))}&author=${encodeURIComponent(preprint.author.displayName ?? preprint.author.handle ?? '')}&handle=${encodeURIComponent(preprint.author.handle ?? '')}`,
      }
    : null;

  // Build share content for review sharing
  const reviewShareContent: ShareContent | null =
    reviewToShare && preprint
      ? {
          type: 'review',
          url: `${typeof window !== 'undefined' ? window.location.origin : ''}/preprints/${encodeURIComponent(uri)}#review-${encodeURIComponent(reviewToShare.uri)}`,
          title: `Review by ${reviewToShare.author.displayName || reviewToShare.author.handle}`,
          description: reviewToShare.content.slice(0, 200),
          ogImageUrl: `/api/og?type=review&uri=${encodeURIComponent(reviewToShare.uri)}&content=${encodeURIComponent(reviewToShare.content.slice(0, 200))}&reviewer=${encodeURIComponent(reviewToShare.author.displayName || '')}&reviewerHandle=${encodeURIComponent(reviewToShare.author.handle || '')}&preprintTitle=${encodeURIComponent(preprint.title)}`,
        }
      : null;

  // Build share content for endorsement sharing
  const endorsementShareContent: ShareContent | null =
    endorsementToShare && preprint
      ? {
          type: 'endorsement',
          url: `${typeof window !== 'undefined' ? window.location.origin : ''}/preprints/${encodeURIComponent(uri)}#endorsement-${encodeURIComponent(endorsementToShare.uri)}`,
          title: `Endorsement by ${endorsementToShare.endorser.displayName || endorsementToShare.endorser.handle}`,
          description: endorsementToShare.contributions.join(', '),
          ogImageUrl: `/api/og?type=endorsement&uri=${encodeURIComponent(endorsementToShare.uri)}&contributions=${encodeURIComponent(endorsementToShare.contributions.join(','))}&comment=${encodeURIComponent(endorsementToShare.comment || '')}&endorser=${encodeURIComponent(endorsementToShare.endorser.displayName || '')}&endorserHandle=${encodeURIComponent(endorsementToShare.endorser.handle || '')}&preprintTitle=${encodeURIComponent(preprint.title)}`,
        }
      : null;

  if (isLoading) {
    return <PreprintDetailLoadingSkeleton />;
  }

  if (error) {
    if (error.message.includes('not found') || error.message.includes('404')) {
      notFound();
    }

    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
        <h2 className="text-lg font-semibold text-destructive">Failed to load preprint</h2>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (!preprint) {
    notFound();
  }

  return (
    <article className="space-y-8">
      {/* Header with title, authors, metadata */}
      <PreprintHeader preprint={preprint} />

      {/* Version selector (if multiple versions) */}
      {preprint.versions && preprint.versions.length > 1 && (
        <PreprintVersionSelector
          versions={preprint.versions}
          currentVersion={displayVersion}
          onVersionChange={handleVersionChange}
        />
      )}

      <Separator />

      {/* Main content tabs */}
      <Tabs defaultValue="abstract" className="space-y-6">
        <TabsList>
          <TabsTrigger value="abstract">Abstract</TabsTrigger>
          <TabsTrigger value="pdf">PDF</TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5">
            Reviews
            {reviewsData?.reviews && reviewsData.reviews.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {reviewsData.reviews.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="endorsements" className="gap-1.5">
            Endorsements
            {endorsementSummary && endorsementSummary.total > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {endorsementSummary.total}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="related" className="gap-1.5">
            <Sparkles className="h-3 w-3" />
            Related
          </TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          {preprint.versions && preprint.versions.length > 1 && (
            <TabsTrigger value="versions">Versions</TabsTrigger>
          )}
        </TabsList>

        {/* Abstract tab */}
        <TabsContent value="abstract" className="space-y-6">
          <PreprintAbstract abstract={preprint.abstract} defaultExpanded />

          {/* Quick actions */}
          <div className="flex flex-wrap gap-4">
            <PDFDownloadButton
              blobRef={preprint.document}
              pdsEndpoint={preprint.source.pdsEndpoint}
              did={preprint.author.did}
              filename={`${preprint.title}.pdf`}
            />

            {/* Endorse button */}
            {isAuthenticated ? (
              !userEndorsement && (
                <Button variant="outline" onClick={() => setShowEndorsementForm(true)}>
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Endorse
                </Button>
              )
            ) : (
              <Button variant="outline" asChild>
                <a href="/login">
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Endorse
                </a>
              </Button>
            )}

            {/* Share menu */}
            {shareContent && (
              <ShareMenu
                content={shareContent}
                onShareToBluesky={() => {
                  if (isAuthenticated) {
                    setShowShareDialog(true);
                  } else {
                    // Redirect to login with return URL
                    window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
                  }
                }}
              />
            )}
          </div>

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

          {/* Share review to Bluesky dialog */}
          {reviewShareContent && currentUser && (
            <ShareToBlueskyDialog
              open={!!reviewToShare}
              onOpenChange={(open) => {
                if (!open) setReviewToShare(null);
              }}
              content={reviewShareContent}
              user={{
                did: currentUser.did,
                displayName: currentUser.displayName ?? currentUser.handle,
                handle: currentUser.handle,
                avatar: currentUser.avatar,
              }}
              onSubmit={handleBlueskyReviewPost}
            />
          )}

          {/* Share endorsement to Bluesky dialog */}
          {endorsementShareContent && currentUser && (
            <ShareToBlueskyDialog
              open={!!endorsementToShare}
              onOpenChange={(open) => {
                if (!open) setEndorsementToShare(null);
              }}
              content={endorsementShareContent}
              user={{
                did: currentUser.did,
                displayName: currentUser.displayName ?? currentUser.handle,
                handle: currentUser.handle,
                avatar: currentUser.avatar,
              }}
              onSubmit={handleBlueskyEndorsementPost}
            />
          )}
        </TabsContent>

        {/* PDF viewer tab with annotation split view */}
        <TabsContent value="pdf">
          <div className="flex gap-4">
            {/* Main PDF viewer */}
            <div className={showAnnotationSidebar ? 'flex-1' : 'w-full'}>
              <div className="mb-2 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAnnotationSidebar(!showAnnotationSidebar)}
                >
                  {showAnnotationSidebar ? 'Hide annotations' : 'Show annotations'}
                </Button>
                <div className="flex gap-2">
                  <PDFDownloadButton
                    blobRef={preprint.document}
                    pdsEndpoint={preprint.source.pdsEndpoint}
                    did={preprint.author.did}
                    filename={`${preprint.title}.pdf`}
                    className="h-8 text-xs"
                  />
                  {shareContent && (
                    <ShareMenu
                      content={shareContent}
                      size="sm"
                      onShareToBluesky={() => {
                        if (isAuthenticated) {
                          setShowShareDialog(true);
                        } else {
                          window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
                        }
                      }}
                    />
                  )}
                </div>
              </div>
              <AnnotatedPDFViewer
                blobRef={preprint.document}
                pdsEndpoint={preprint.source.pdsEndpoint}
                did={preprint.author.did}
                preprintUri={uri}
                onAnnotationSelect={handleAnnotationSelect}
                onAddReview={handleAddInlineReview}
                onLinkEntity={handleLinkEntity}
                scrollToAnnotationUri={selectedAnnotationUri ?? undefined}
                className="min-h-[600px]"
              />
            </div>

            {/* Annotation sidebar */}
            {showAnnotationSidebar && (
              <div className="w-80 shrink-0">
                <AnnotationSidebar
                  preprintUri={uri}
                  selectedUri={selectedAnnotationUri ?? undefined}
                  onAnnotationClick={handleSidebarAnnotationClick}
                  className="sticky top-4 max-h-[calc(100vh-8rem)]"
                />
              </div>
            )}
          </div>

          {/* Inline review form (shown when creating inline annotation) */}
          {inlineReviewTarget && showReviewForm && (
            <div className="mt-4 rounded-lg border bg-card p-4">
              <div className="mb-2 text-sm text-muted-foreground">
                Annotating:{' '}
                <span className="italic">
                  &ldquo;{inlineReviewTarget.selectedText.slice(0, 100)}
                  {inlineReviewTarget.selectedText.length > 100 && '...'}&rdquo;
                </span>
              </div>
              <ReviewForm
                preprintUri={uri}
                onSubmit={handleSubmitInlineReview}
                onCancel={() => {
                  setShowReviewForm(false);
                  setInlineReviewTarget(null);
                }}
                isLoading={createReview.isPending}
              />
            </div>
          )}

          {/* Entity link dialog */}
          <EntityLinkDialog
            open={entityLinkDialogOpen}
            onOpenChange={setEntityLinkDialogOpen}
            selectedText={entityLinkSelection?.selectedText ?? ''}
            onLink={async (entity) => {
              // Create an annotation with entity reference
              // The annotation body includes the linked entity as embedded content
              if (!entityLinkSelection?.target) {
                setEntityLinkDialogOpen(false);
                setEntityLinkSelection(null);
                return;
              }

              try {
                // Create entity link content and URL based on entity type
                let entityLabel: string;
                let entityUrl: string;

                switch (entity.type) {
                  case 'wikidata':
                    entityLabel = entity.label;
                    entityUrl = entity.url;
                    break;
                  case 'authority':
                    entityLabel = entity.authorizedForm;
                    entityUrl = entity.uri;
                    break;
                  case 'field':
                    entityLabel = entity.label;
                    entityUrl = entity.uri;
                    break;
                  case 'author':
                    entityLabel = entity.displayName ?? entity.did;
                    entityUrl = `/authors/${encodeURIComponent(entity.did)}`;
                    break;
                  case 'preprint':
                    entityLabel = entity.title;
                    entityUrl = entity.uri;
                    break;
                  case 'fast':
                    entityLabel = entity.label;
                    entityUrl = entity.uri;
                    break;
                  case 'orcid':
                    entityLabel = entity.displayName ?? entity.did;
                    entityUrl = `/authors/${encodeURIComponent(entity.did)}`;
                    break;
                  default: {
                    // Type guard: should never reach here.
                    const _exhaustive: never = entity;
                    throw new Error(
                      `Unknown entity type: ${(_exhaustive as { type: string }).type}`
                    );
                  }
                }

                // Create text content with the entity reference
                const entityContent = `Linked to: ${entityLabel}`;

                // Create the review with entity link annotation using Bluesky facet format
                await createReview.mutateAsync({
                  preprintUri: uri,
                  content: entityContent,
                  target: entityLinkSelection.target,
                  motivation: 'linking',
                  body: {
                    text: entityContent,
                    facets: [
                      {
                        index: {
                          byteStart: 'Linked to: '.length,
                          byteEnd: entityContent.length,
                        },
                        features: [
                          {
                            $type: 'app.bsky.richtext.facet#link' as const,
                            uri: entityUrl,
                          },
                        ],
                      },
                    ],
                  },
                });
              } catch (error) {
                console.error('Failed to create entity link annotation:', error);
              }

              setEntityLinkDialogOpen(false);
              setEntityLinkSelection(null);
            }}
          />
        </TabsContent>

        {/* Reviews tab */}
        <TabsContent value="reviews" className="space-y-6">
          {/* Review form */}
          {isAuthenticated ? (
            showReviewForm ? (
              <ReviewForm
                preprintUri={uri}
                parentReview={replyingTo ?? undefined}
                onSubmit={handleSubmitReview}
                onCancel={() => {
                  setShowReviewForm(false);
                  setReplyingTo(null);
                }}
                isLoading={createReview.isPending}
              />
            ) : (
              <Button onClick={() => setShowReviewForm(true)}>Write a review</Button>
            )
          ) : (
            <LoginPrompt action="write a review" />
          )}

          <Separator />

          {/* Reviews list */}
          {reviewsLoading ? (
            <ReviewListSkeleton count={3} />
          ) : reviewsData?.reviews && reviewsData.reviews.length > 0 ? (
            <ReviewList
              reviews={reviewsData.reviews}
              layout="threaded"
              onReply={isAuthenticated ? handleReply : undefined}
              onShare={isAuthenticated ? handleShareReview : undefined}
              showTargets
            />
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No reviews yet. Be the first to share your thoughts!
            </p>
          )}
        </TabsContent>

        {/* Endorsements tab */}
        <TabsContent value="endorsements" className="space-y-6">
          {/* User endorsement status */}
          {isAuthenticated && userEndorsement && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">
                You have endorsed this preprint for:{' '}
                <span className="font-medium text-foreground">
                  {userEndorsement.contributions.join(', ')}
                </span>
              </p>
            </div>
          )}

          {/* Endorse button or login prompt */}
          {isAuthenticated ? (
            !userEndorsement && (
              <Button onClick={() => setShowEndorsementForm(true)}>Endorse this preprint</Button>
            )
          ) : (
            <LoginPrompt action="endorse this preprint" />
          )}

          <Separator />

          {/* Full endorsement panel */}
          <EndorsementPanel
            preprintUri={uri}
            currentUserDid={currentUser?.did}
            onEndorse={
              isAuthenticated && !userEndorsement ? () => setShowEndorsementForm(true) : undefined
            }
            onShareEndorsement={isAuthenticated ? handleShareEndorsement : undefined}
          />

          {/* Endorsement form dialog */}
          <EndorsementForm
            preprintUri={uri}
            open={showEndorsementForm}
            onOpenChange={setShowEndorsementForm}
            onSubmit={handleSubmitEndorsement}
            isLoading={createEndorsement.isPending}
          />
        </TabsContent>

        {/* Related papers tab */}
        <TabsContent value="related" className="space-y-6">
          <RelatedPapersPanel preprintUri={uri} limit={5} showCitations />

          {/* Backlinks from external sources (Semble, Bluesky, etc.) */}
          <BacklinksPanel preprintUri={uri} />
        </TabsContent>

        {/* Metadata tab */}
        <TabsContent value="metadata" className="space-y-6">
          <PreprintMetadata
            fields={preprint.fields}
            keywords={preprint.keywords}
            license={preprint.license}
            doi={preprint.doi}
            layout="stacked"
          />

          <Separator />

          {/* External enrichment data (S2, OpenAlex citations, topics, concepts) */}
          <EnrichmentPanel preprintUri={uri} />

          <Separator />

          {/* Tags section */}
          <TagManager preprintUri={uri} editable={isAuthenticated} />

          <Separator />

          {/* Linked resources (GitHub, Zenodo, etc.) */}
          <IntegrationPanel preprintUri={uri} />

          <Separator />

          {/* ATProto source information */}
          <PreprintSource source={preprint.source} variant="card" />
        </TabsContent>

        {/* Versions tab */}
        {preprint.versions && preprint.versions.length > 1 && (
          <TabsContent value="versions">
            <PreprintVersionTimeline
              versions={preprint.versions}
              currentVersion={displayVersion}
              onVersionClick={handleVersionChange}
            />
          </TabsContent>
        )}
      </Tabs>
    </article>
  );
}

/**
 * Full loading skeleton for the preprint detail page.
 */
function PreprintDetailLoadingSkeleton() {
  return (
    <article className="space-y-8">
      <PreprintHeaderSkeleton />
      <Separator />
      <div className="space-y-6">
        {/* Tab skeleton */}
        <div className="flex gap-2">
          <div className="h-9 w-20 animate-pulse rounded bg-muted" />
          <div className="h-9 w-16 animate-pulse rounded bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
        </div>

        {/* Content skeleton */}
        <div className="space-y-4">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </article>
  );
}
