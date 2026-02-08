'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { logger } from '@/lib/observability';

const eprintLogger = logger.child({ component: 'eprint-content' });

import {
  EprintHeader,
  EprintHeaderSkeleton,
  EprintAbstract,
  EprintMetadata,
  EprintSource,
  EprintVersionSelector,
  EprintVersionTimeline,
  PDFDownloadButton,
  AnnotatedPDFViewerSkeleton,
  PublicationBadge,
  SupplementaryPanel,
  FundingPanel,
  RepositoriesPanel,
  SchemaMigrationBanner,
  DeleteEprintDialog,
  PaperAuthGate,
  EprintEditDialog,
  VersionHistory,
  type SupplementaryCategory,
} from '@/components/eprints';

// Dynamic import to prevent SSR issues with pdfjs-dist browser globals
const AnnotatedPDFViewer = dynamic(
  () => import('@/components/eprints/pdf-viewer-annotated').then((mod) => mod.AnnotatedPDFViewer),
  {
    ssr: false,
    loading: () => <AnnotatedPDFViewerSkeleton className="min-h-[600px]" />,
  }
);
import { AnnotationSidebar, EntityLinkDialog } from '@/components/annotations';
import type { UnifiedTextSpanTarget, EprintSource as EprintSourceType } from '@/lib/api/schema';
import {
  ReviewList,
  ReviewListSkeleton,
  ReviewForm,
  DeleteReviewDialog,
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
import type { RichTextItem } from '@/lib/types/rich-text';
import { BacklinksPanel } from '@/components/backlinks';
import { EnrichmentPanel } from '@/components/enrichment';
import { Sparkles, Pencil, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useEprint } from '@/lib/hooks/use-eprint';
import {
  useReviews,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
} from '@/lib/hooks/use-review';
import {
  useEndorsementSummary,
  useUserEndorsement,
  useCreateEndorsement,
  useUpdateEndorsement,
  useDeleteEndorsement,
} from '@/lib/hooks/use-endorsement';
import { useIsAuthenticated, useCurrentUser, useAgent } from '@/lib/auth';
import { useEprintPermissions, useDeleteEprint } from '@/lib/hooks';
import type { Review, Endorsement, ContributionType } from '@/lib/api/schema';
import { ShareMenu, ShareToBlueskyDialog } from '@/components/share';
import { createBlueskyPost, type ShareContent } from '@/lib/bluesky';
import { toast } from 'sonner';

/**
 * Map document format to display label for the document tab.
 */
function getDocumentTabLabel(format: string | undefined): string {
  switch (format?.toLowerCase()) {
    case 'pdf':
      return 'PDF';
    case 'html':
      return 'HTML';
    case 'markdown':
    case 'md':
      return 'Markdown';
    case 'jupyter':
    case 'ipynb':
      return 'Notebook';
    case 'latex':
    case 'tex':
      return 'LaTeX';
    case 'txt':
    case 'text':
      return 'Text';
    default:
      return format?.toUpperCase() || 'Document';
  }
}

/**
 * Valid supplementary material categories.
 * Used for type narrowing from lexicon's open union to component's strict union.
 */
const VALID_SUPPLEMENTARY_CATEGORIES: readonly SupplementaryCategory[] = [
  'appendix',
  'figure',
  'table',
  'dataset',
  'code',
  'notebook',
  'video',
  'audio',
  'presentation',
  'protocol',
  'questionnaire',
  'other',
] as const;

/**
 * Type guard for supplementary category.
 */
function isValidSupplementaryCategory(value: string | undefined): value is SupplementaryCategory {
  return VALID_SUPPLEMENTARY_CATEGORIES.includes(value as SupplementaryCategory);
}

/**
 * Props for the EprintDetailContent component.
 */
export interface EprintDetailContentProps {
  /** Eprint AT URI */
  uri: string;
}

/**
 * Client-side eprint detail content.
 *
 * @remarks
 * Fetches and displays full eprint details including header,
 * abstract, metadata, PDF viewer, and version history.
 *
 * @param props - Component props
 * @returns React element with eprint detail content
 */
export function EprintDetailContent({ uri }: EprintDetailContentProps) {
  const { data: eprint, isLoading, error } = useEprint(uri);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>('abstract');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Review | null>(null);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [showEndorsementForm, setShowEndorsementForm] = useState(false);
  const [editingEndorsement, setEditingEndorsement] = useState<Endorsement | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Review/endorsement sharing state
  const [reviewToShare, setReviewToShare] = useState<Review | null>(null);
  const [endorsementToShare, setEndorsementToShare] = useState<Endorsement | null>(null);

  // Delete review confirmation state
  const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);

  // Annotation state
  const [showAnnotationSidebar, setShowAnnotationSidebar] = useState(true);
  const [selectedAnnotationUri, setSelectedAnnotationUri] = useState<string | null>(null);
  const [entityLinkDialogOpen, setEntityLinkDialogOpen] = useState(false);
  const [entityLinkSelection, setEntityLinkSelection] = useState<{
    target: UnifiedTextSpanTarget;
    selectedText: string;
  } | null>(null);
  const [inlineReviewTarget, setInlineReviewTarget] = useState<{
    target: UnifiedTextSpanTarget;
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
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();
  const createEndorsement = useCreateEndorsement();
  const updateEndorsement = useUpdateEndorsement();
  const deleteEndorsement = useDeleteEndorsement();

  // Eprint permissions and mutations
  const permissions = useEprintPermissions(
    eprint ? { submittedBy: eprint.submittedBy, paperDid: eprint.paperDid } : undefined,
    currentUser?.did
  );
  const deleteEprint = useDeleteEprint();

  // Get the selected version or latest
  const displayVersion = currentVersion ?? eprint?.versions?.length ?? 1;

  // Construct source object for ATProto transparency display
  const eprintSource: EprintSourceType | undefined = eprint
    ? {
        pdsEndpoint: eprint.pdsUrl,
        recordUrl: eprint.uri,
      }
    : undefined;

  /**
   * Handle version change by updating state and triggering refetch.
   * The useEprint hook should be called with version parameter when specified.
   */
  const handleVersionChange = useCallback((version: number) => {
    setCurrentVersion(version);
    // Version-specific data is handled via the eprint.versions array
    // Each version contains its own document BlobRef, so the PDFViewer
    // will automatically load the correct version when eprint data changes
  }, []);

  const handleReply = useCallback((review: Review) => {
    setReplyingTo(review);
    setEditingReview(null);
    setShowReviewForm(true);
  }, []);

  const handleEditReview = useCallback((review: Review) => {
    setEditingReview(review);
    setReplyingTo(null);
    setShowReviewForm(true);
  }, []);

  const handleDeleteReview = useCallback((review: Review) => {
    setReviewToDelete(review);
  }, []);

  const handleConfirmDeleteReview = useCallback(async () => {
    if (!reviewToDelete) return;
    try {
      await deleteReview.mutateAsync({ uri: reviewToDelete.uri, eprintUri: uri });
      toast.success('Review deleted successfully');
      setReviewToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete review');
    }
  }, [deleteReview, reviewToDelete, uri]);

  const handleSubmitReview = useCallback(
    async (data: ReviewFormData) => {
      if (editingReview) {
        await updateReview.mutateAsync({
          uri: editingReview.uri,
          eprintUri: uri,
          content: data.content,
        });
        toast.success('Review updated successfully');
      } else {
        await createReview.mutateAsync({
          eprintUri: uri,
          content: data.content,
          parentReviewUri: data.parentReviewUri,
        });
        toast.success('Review posted successfully');
      }
      setShowReviewForm(false);
      setReplyingTo(null);
      setEditingReview(null);
    },
    [uri, createReview, updateReview, editingReview]
  );

  const handleSubmitEndorsement = useCallback(
    async (data: EndorsementFormData) => {
      try {
        if (editingEndorsement) {
          await updateEndorsement.mutateAsync({
            uri: editingEndorsement.uri,
            eprintUri: uri,
            contributions: data.contributions,
            comment: data.comment,
          });
          setEditingEndorsement(null);
          setShowEndorsementForm(false);
          toast.success('Endorsement updated successfully');
        } else {
          await createEndorsement.mutateAsync({
            eprintUri: uri,
            contributions: data.contributions,
            comment: data.comment,
          });
          setShowEndorsementForm(false);
          toast.success('Endorsement submitted successfully');
        }
      } catch (error) {
        // Error is displayed in the form via error prop
        // Don't close the form so user can see the error and retry
        toast.error(error instanceof Error ? error.message : 'Failed to submit endorsement');
      }
    },
    [uri, createEndorsement, updateEndorsement, editingEndorsement]
  );

  const handleEditEndorsement = useCallback((endorsement: Endorsement) => {
    setEditingEndorsement(endorsement);
    setShowEndorsementForm(true);
  }, []);

  const handleDeleteEndorsement = useCallback(
    async (endorsement: Endorsement) => {
      try {
        await deleteEndorsement.mutateAsync({ uri: endorsement.uri, eprintUri: uri });
        toast.success('Endorsement deleted successfully');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete endorsement');
      }
    },
    [deleteEndorsement, uri]
  );

  const handleDeleteEprint = useCallback(async () => {
    try {
      // Step 1: Validate authorization via backend
      await deleteEprint.mutateAsync({ uri });

      // Step 2: Delete record from PDS via ATProto client
      // The record lives in either the user's PDS or the paper's PDS
      if (agent) {
        const uriParts = uri.split('/');
        const rkey = uriParts.pop() ?? '';
        const collection = uriParts.pop() ?? 'pub.chive.eprint.submission';
        const repo = eprint?.paperDid ?? eprint?.submittedBy ?? agent.did;

        if (repo) {
          await agent.com.atproto.repo.deleteRecord({
            repo,
            collection,
            rkey,
          });
        }
      }

      toast.success('Eprint deleted successfully');
      // Redirect to eprints list after deletion
      window.location.href = '/eprints';
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete eprint');
    }
  }, [deleteEprint, uri, agent, eprint?.paperDid, eprint?.submittedBy]);

  /**
   * Build edit data object from eprint.
   * Extracts the rkey from the AT-URI for PDS operations.
   */
  const eprintEditData = eprint
    ? {
        uri: eprint.uri,
        rkey: eprint.uri.split('/').pop() ?? '',
        collection: 'pub.chive.eprint.submission',
        title: eprint.title,
        abstract: eprint.abstract,
        keywords: eprint.keywords,
        version: eprint.version,
        repo: eprint.paperDid ?? eprint.submittedBy,
      }
    : null;

  // Annotation handlers
  const handleAnnotationSelect = useCallback((annotationUri: string) => {
    setSelectedAnnotationUri(annotationUri);
  }, []);

  const handleAddInlineReview = useCallback(
    (target: UnifiedTextSpanTarget, selectedText: string) => {
      setInlineReviewTarget({ target, selectedText });
      setShowReviewForm(true);
    },
    []
  );

  const handleLinkEntity = useCallback((target: UnifiedTextSpanTarget, selectedText: string) => {
    setEntityLinkSelection({ target, selectedText });
    setEntityLinkDialogOpen(true);
  }, []);

  const handleSubmitInlineReview = useCallback(
    async (data: ReviewFormData) => {
      await createReview.mutateAsync({
        eprintUri: uri,
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
      eprintLogger.info('Sidebar annotation clicked', { annotationUri, pageNumber: _pageNumber });
      setSelectedAnnotationUri(annotationUri);
      // The AnnotatedPDFViewer component automatically scrolls to the annotation
      // when scrollToAnnotationUri prop changes via its useEffect hook
    },
    []
  );

  /**
   * Handle "Go to location" click from review cards.
   * Switches to PDF tab and scrolls to the annotation.
   */
  const handleGoToLocation = useCallback((reviewUri: string) => {
    eprintLogger.info('Go to location clicked', { reviewUri });
    // Switch to PDF tab (works for PDF documents; text formats would use 'document' tab)
    setActiveTab('pdf');
    // Set the annotation URI to trigger scrolling in the PDF viewer
    setSelectedAnnotationUri(reviewUri);
  }, []);

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
      if (!agent || !eprint) {
        throw new Error('Not authenticated');
      }

      const result = await createBlueskyPost(agent, {
        text,
        embed: {
          uri: `${window.location.origin}/eprints/${encodeURIComponent(uri)}`,
          title: eprint.title,
          description: eprint.abstract.slice(0, 200),
          thumbBlob: ogImageBlob,
        },
      });

      return { rkey: result.rkey };
    },
    [agent, eprint, uri]
  );

  // Handle Bluesky post submission for reviews
  const handleBlueskyReviewPost = useCallback(
    async (text: string, ogImageBlob: Uint8Array | undefined): Promise<{ rkey: string }> => {
      if (!agent || !eprint || !reviewToShare) {
        throw new Error('Not authenticated');
      }

      const result = await createBlueskyPost(agent, {
        text,
        embed: {
          uri: `${window.location.origin}/eprints/${encodeURIComponent(uri)}#review-${encodeURIComponent(reviewToShare.uri)}`,
          title: `Review by ${reviewToShare.author.displayName || reviewToShare.author.handle}`,
          description: reviewToShare.content.slice(0, 200),
          thumbBlob: ogImageBlob,
        },
      });

      return { rkey: result.rkey };
    },
    [agent, eprint, uri, reviewToShare]
  );

  // Handle Bluesky post submission for endorsements
  const handleBlueskyEndorsementPost = useCallback(
    async (text: string, ogImageBlob: Uint8Array | undefined): Promise<{ rkey: string }> => {
      if (!agent || !eprint || !endorsementToShare) {
        throw new Error('Not authenticated');
      }

      const result = await createBlueskyPost(agent, {
        text,
        embed: {
          uri: `${window.location.origin}/eprints/${encodeURIComponent(uri)}#endorsement-${encodeURIComponent(endorsementToShare.uri)}`,
          title: `Endorsement by ${endorsementToShare.endorser.displayName || endorsementToShare.endorser.handle}`,
          description: endorsementToShare.contributions.join(', '),
          thumbBlob: ogImageBlob,
        },
      });

      return { rkey: result.rkey };
    },
    [agent, eprint, uri, endorsementToShare]
  );

  // Build share content for the dialog
  // Use default OG image (Chive logo/branding) for all shares
  const shareContent: ShareContent | null = eprint
    ? {
        type: 'eprint',
        url: `${typeof window !== 'undefined' ? window.location.origin : ''}/eprints/${encodeURIComponent(uri)}`,
        title: eprint.title,
        description: eprint.abstract.slice(0, 200),
        ogImageUrl: '/api/og?type=default',
      }
    : null;

  // Build share content for review sharing
  const reviewShareContent: ShareContent | null =
    reviewToShare && eprint
      ? {
          type: 'review',
          url: `${typeof window !== 'undefined' ? window.location.origin : ''}/eprints/${encodeURIComponent(uri)}#review-${encodeURIComponent(reviewToShare.uri)}`,
          title: `Review by ${reviewToShare.author.displayName || reviewToShare.author.handle}`,
          description: reviewToShare.content.slice(0, 200),
          ogImageUrl: '/api/og?type=default',
        }
      : null;

  // Build share content for endorsement sharing
  const endorsementShareContent: ShareContent | null =
    endorsementToShare && eprint
      ? {
          type: 'endorsement',
          url: `${typeof window !== 'undefined' ? window.location.origin : ''}/eprints/${encodeURIComponent(uri)}#endorsement-${encodeURIComponent(endorsementToShare.uri)}`,
          title: `Endorsement by ${endorsementToShare.endorser.displayName || endorsementToShare.endorser.handle}`,
          description: endorsementToShare.contributions.join(', '),
          ogImageUrl: '/api/og?type=default',
        }
      : null;

  if (isLoading) {
    return <EprintDetailLoadingSkeleton />;
  }

  if (error) {
    if (error.message.includes('not found') || error.message.includes('404')) {
      notFound();
    }

    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
        <h2 className="text-lg font-semibold text-destructive">Failed to load eprint</h2>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (!eprint) {
    notFound();
  }

  // Quick edit pencil icon for the title (shown to owners)
  const titleEditAction =
    permissions.canModify && eprintEditData ? (
      permissions.requiresPaperAuth ? (
        <PaperAuthGate eprint={{ paperDid: eprint.paperDid }}>
          <EprintEditDialog eprint={eprintEditData} canEdit={permissions.canModify}>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Quick edit">
              <Pencil className="h-4 w-4" />
            </Button>
          </EprintEditDialog>
        </PaperAuthGate>
      ) : (
        <EprintEditDialog eprint={eprintEditData} canEdit={permissions.canModify}>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Quick edit">
            <Pencil className="h-4 w-4" />
          </Button>
        </EprintEditDialog>
      )
    ) : undefined;

  return (
    <article className="space-y-8 overflow-x-hidden">
      {/* Header with title, authors, metadata */}
      <EprintHeader eprint={eprint} titleAction={titleEditAction} />

      {/* Owner actions (Edit/Delete) - only shown to authorized users */}
      {permissions.canModify && eprintEditData && (
        <div className="flex items-center gap-2">
          {permissions.requiresPaperAuth ? (
            <PaperAuthGate eprint={{ paperDid: eprint.paperDid }}>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/eprints/edit/${encodeURIComponent(uri)}`}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </Button>
                <DeleteEprintDialog
                  title={eprint.title}
                  uri={eprint.uri}
                  canDelete={permissions.canModify}
                  isPending={deleteEprint.isPending}
                  onConfirm={handleDeleteEprint}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </DeleteEprintDialog>
              </div>
            </PaperAuthGate>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/eprints/edit/${encodeURIComponent(uri)}`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </Button>
              <DeleteEprintDialog
                title={eprint.title}
                uri={eprint.uri}
                canDelete={permissions.canModify}
                isPending={deleteEprint.isPending}
                onConfirm={handleDeleteEprint}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </DeleteEprintDialog>
            </>
          )}
        </div>
      )}

      {/* Schema migration banner (shows when record uses deprecated formats) */}
      <SchemaMigrationBanner
        schemaHints={eprint._schemaHints}
        eprint={{
          uri: eprint.uri,
          submittedBy: eprint.submittedBy,
          paperDid: eprint.paperDid,
        }}
        currentUserDid={currentUser?.did}
      />

      {/* Publication status badge */}
      {eprint.publicationStatus &&
        eprint.publicationStatus !== 'preprint' &&
        eprint.publicationStatus !== 'eprint' && (
          <PublicationBadge
            status={
              eprint.publicationStatus as
                | 'under_review'
                | 'revision_requested'
                | 'accepted'
                | 'in_press'
                | 'published'
                | 'retracted'
            }
            publishedVersion={eprint.publishedVersion}
            variant="card"
          />
        )}

      {/* Version selector (if multiple versions) */}
      {eprint.versions && eprint.versions.length > 1 && (
        <EprintVersionSelector
          versions={eprint.versions}
          currentVersion={displayVersion}
          onVersionChange={handleVersionChange}
        />
      )}

      <Separator />

      {/* Main content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="abstract">Abstract</TabsTrigger>
          <TabsTrigger value="pdf">{getDocumentTabLabel(eprint.documentFormatUri)}</TabsTrigger>
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
          {eprint.versions && eprint.versions.length > 1 && (
            <TabsTrigger value="versions">Versions</TabsTrigger>
          )}
        </TabsList>

        {/* Abstract tab */}
        <TabsContent value="abstract" className="space-y-6">
          <EprintAbstract
            abstractItems={(eprint.abstractItems ?? []) as RichTextItem[]}
            defaultExpanded
          />

          {/* Quick actions */}
          <div className="flex flex-wrap gap-4">
            {eprint.document && (
              <PDFDownloadButton
                blobRef={eprint.document}
                pdsEndpoint={eprint.pdsUrl}
                did={eprint.paperDid ?? eprint.submittedBy}
                filename={`${eprint.title}.pdf`}
              />
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
          <div className="flex gap-4 w-full overflow-hidden">
            {/* Main PDF viewer */}
            <div
              className={
                showAnnotationSidebar
                  ? 'flex-1 w-0 min-w-0 overflow-hidden'
                  : 'w-full overflow-hidden'
              }
            >
              <div className="mb-2 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAnnotationSidebar(!showAnnotationSidebar)}
                >
                  {showAnnotationSidebar ? 'Hide annotations' : 'Show annotations'}
                </Button>
                <div className="flex gap-2">
                  {eprint.document && (
                    <PDFDownloadButton
                      blobRef={eprint.document}
                      pdsEndpoint={eprint.pdsUrl}
                      did={eprint.paperDid ?? eprint.submittedBy}
                      filename={`${eprint.title}.pdf`}
                      className="h-8 text-xs"
                    />
                  )}
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
              {eprint.document ? (
                <AnnotatedPDFViewer
                  blobRef={eprint.document}
                  pdsEndpoint={eprint.pdsUrl}
                  did={eprint.paperDid ?? eprint.submittedBy}
                  eprintUri={uri}
                  onAnnotationSelect={handleAnnotationSelect}
                  onAddReview={handleAddInlineReview}
                  onLinkEntity={handleLinkEntity}
                  scrollToAnnotationUri={selectedAnnotationUri ?? undefined}
                  className="min-h-[600px]"
                />
              ) : (
                <div className="flex min-h-[600px] items-center justify-center rounded-lg border border-dashed">
                  <p className="text-muted-foreground">No PDF document available</p>
                </div>
              )}
            </div>

            {/* Annotation sidebar */}
            {showAnnotationSidebar && (
              <div className="w-80 shrink-0">
                <AnnotationSidebar
                  eprintUri={uri}
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
                eprintUri={uri}
                target={inlineReviewTarget.target}
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
                  case 'nodeRef':
                    entityLabel = entity.label;
                    entityUrl = `/graph/${encodeURIComponent(entity.uri)}`;
                    break;
                  case 'field':
                    entityLabel = entity.label;
                    entityUrl = entity.uri;
                    break;
                  case 'author':
                    entityLabel = entity.displayName ?? entity.did;
                    entityUrl = `/authors/${encodeURIComponent(entity.did)}`;
                    break;
                  case 'eprint':
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
                const prefix = 'Linked to: ';
                const entityContent = `${prefix}${entityLabel}`;

                // Calculate byte positions for the facet (the label portion should be the link)
                const prefixBytes = new TextEncoder().encode(prefix).length;
                const labelBytes = new TextEncoder().encode(entityLabel).length;

                // Create the review with entity link annotation using facets
                await createReview.mutateAsync({
                  eprintUri: uri,
                  content: entityContent,
                  target: entityLinkSelection.target,
                  motivation: 'linking',
                  facets: [
                    {
                      index: {
                        byteStart: prefixBytes,
                        byteEnd: prefixBytes + labelBytes,
                      },
                      features: [
                        {
                          $type: 'app.bsky.richtext.facet#link',
                          uri: entityUrl.startsWith('/')
                            ? `${window.location.origin}${entityUrl}`
                            : entityUrl,
                        },
                      ],
                    },
                  ],
                });
                toast.success('Entity linked successfully');
              } catch (error) {
                eprintLogger.error('Failed to create entity link annotation', error);
                toast.error(
                  error instanceof Error ? error.message : 'Failed to create entity link'
                );
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
                eprintUri={uri}
                editingReview={editingReview ?? undefined}
                parentReview={replyingTo ?? undefined}
                onSubmit={handleSubmitReview}
                onCancel={() => {
                  setShowReviewForm(false);
                  setReplyingTo(null);
                  setEditingReview(null);
                }}
                isLoading={createReview.isPending || updateReview.isPending}
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
              onEdit={isAuthenticated ? handleEditReview : undefined}
              onDelete={isAuthenticated ? handleDeleteReview : undefined}
              onShare={isAuthenticated ? handleShareReview : undefined}
              currentUserDid={currentUser?.did}
              showTargets
              documentFormat={eprint?.documentFormatUri}
              onGoToLocation={handleGoToLocation}
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
              <div className="flex items-start justify-between">
                <p className="text-sm text-muted-foreground">
                  You have endorsed this eprint for:{' '}
                  <span className="font-medium text-foreground">
                    {userEndorsement.contributions.join(', ')}
                  </span>
                </p>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditEndorsement(userEndorsement)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteEndorsement(userEndorsement)}
                    disabled={deleteEndorsement.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Endorse button or login prompt */}
          {isAuthenticated ? (
            !userEndorsement && (
              <Button onClick={() => setShowEndorsementForm(true)}>Endorse this eprint</Button>
            )
          ) : (
            <LoginPrompt action="endorse this eprint" />
          )}

          <Separator />

          {/* Full endorsement panel */}
          <EndorsementPanel
            eprintUri={uri}
            currentUserDid={currentUser?.did}
            onEndorse={
              isAuthenticated && !userEndorsement ? () => setShowEndorsementForm(true) : undefined
            }
            onShareEndorsement={isAuthenticated ? handleShareEndorsement : undefined}
            onEditEndorsement={isAuthenticated ? handleEditEndorsement : undefined}
            onDeleteEndorsement={isAuthenticated ? handleDeleteEndorsement : undefined}
          />

          {/* Endorsement form dialog */}
          <EndorsementForm
            eprintUri={uri}
            open={showEndorsementForm}
            onOpenChange={(open) => {
              setShowEndorsementForm(open);
              if (!open) setEditingEndorsement(null);
            }}
            onSubmit={handleSubmitEndorsement}
            isLoading={createEndorsement.isPending || updateEndorsement.isPending}
            error={createEndorsement.error?.message ?? updateEndorsement.error?.message}
            initialContributions={
              editingEndorsement?.contributions as ContributionType[] | undefined
            }
            initialComment={editingEndorsement?.comment}
          />
        </TabsContent>

        {/* Related papers tab */}
        <TabsContent value="related" className="space-y-6">
          <RelatedPapersPanel eprintUri={uri} limit={5} showCitations />

          {/* Backlinks from external sources (Semble, Bluesky, etc.) */}
          <BacklinksPanel eprintUri={uri} />
        </TabsContent>

        {/* Metadata tab */}
        <TabsContent value="metadata" className="space-y-6">
          <EprintMetadata
            fields={eprint.fields}
            keywords={eprint.keywords}
            license={eprint.license}
            doi={eprint.doi}
            layout="stacked"
          />

          <Separator />

          {/* External enrichment data (S2, OpenAlex citations, topics, concepts) */}
          <EnrichmentPanel eprintUri={uri} />

          <Separator />

          {/* Tags section */}
          <TagManager eprintUri={uri} editable={isAuthenticated} />

          <Separator />

          {/* Funding sources */}
          {eprint.funding && eprint.funding.length > 0 && (
            <>
              <FundingPanel
                funding={eprint.funding
                  .filter((f): f is typeof f & { funderName: string } => !!f.funderName)
                  .map((f) => ({
                    funderName: f.funderName,
                    funderDoi: f.funderDoi,
                    funderRor: f.funderRor,
                    grantNumber: f.grantNumber,
                    grantTitle: f.grantTitle,
                    grantUrl: f.grantUrl,
                  }))}
                variant="card"
              />
              <Separator />
            </>
          )}

          {/* Supplementary materials */}
          {eprint.supplementaryMaterials && eprint.supplementaryMaterials.length > 0 && (
            <>
              <SupplementaryPanel
                items={eprint.supplementaryMaterials.map((item, index) => {
                  const did = eprint.paperDid ?? eprint.submittedBy;
                  const blobCid = item.blob?.ref?.toString();
                  const downloadUrl =
                    blobCid && eprint.pdsUrl
                      ? `${eprint.pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(blobCid)}`
                      : undefined;
                  const category = isValidSupplementaryCategory(item.categorySlug)
                    ? item.categorySlug
                    : 'other';
                  return {
                    id: blobCid ?? `supp-${index}`,
                    label: item.label,
                    description: item.description,
                    category,
                    format: item.detectedFormat,
                    downloadUrl,
                  };
                })}
              />
              <Separator />
            </>
          )}

          {/* Code, data, and model repositories */}
          {eprint.repositories && (
            <>
              <RepositoriesPanel repositories={eprint.repositories} />
              <Separator />
            </>
          )}

          {/* Linked resources (GitHub, Zenodo, etc.) */}
          <IntegrationPanel eprintUri={uri} />

          <Separator />

          {/* ATProto source information */}
          {eprintSource && <EprintSource source={eprintSource} variant="card" />}
        </TabsContent>

        {/* Versions tab */}
        {eprint.versions && eprint.versions.length > 1 && (
          <TabsContent value="versions" className="space-y-6">
            <EprintVersionTimeline
              versions={eprint.versions}
              currentVersion={displayVersion}
              onVersionClick={handleVersionChange}
            />
            <VersionHistory eprintUri={eprint.uri} />
          </TabsContent>
        )}
      </Tabs>

      {/* Delete review confirmation dialog */}
      <DeleteReviewDialog
        open={reviewToDelete !== null}
        onOpenChange={(open) => !open && setReviewToDelete(null)}
        hasReplies={(reviewToDelete?.replyCount ?? 0) > 0}
        isPending={deleteReview.isPending}
        onConfirm={handleConfirmDeleteReview}
      />
    </article>
  );
}

/**
 * Full loading skeleton for the eprint detail page.
 */
function EprintDetailLoadingSkeleton() {
  return (
    <article className="space-y-8">
      <EprintHeaderSkeleton />
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
