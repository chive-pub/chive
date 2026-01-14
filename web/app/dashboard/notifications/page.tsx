'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  UserPlus,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  Loader2,
  CheckCircle2,
  MessageSquare,
  ThumbsUp,
} from 'lucide-react';

import {
  useCoauthorRequests,
  useApproveCoauthor,
  useRejectCoauthor,
  useReviewNotifications,
  useEndorsementNotifications,
} from '@/lib/hooks';
import { getCurrentAgent } from '@/lib/auth';
import { addCoauthorToEprint } from '@/lib/atproto/record-creator';
import type { CoauthorClaimRequest } from '@/lib/api/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

/**
 * Notifications page for PDS owners.
 *
 * @remarks
 * Shows notifications about:
 * - Co-author requests on the user's eprints
 * - New reviews on the user's papers
 * - New endorsements on the user's papers
 */
export default function NotificationsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Activity and requests related to your papers on Chive
        </p>
      </div>

      {/* Co-author requests section */}
      <CoauthorRequestsSection />

      {/* Reviews section */}
      <ReviewsNotificationsSection />

      {/* Endorsements section */}
      <EndorsementsNotificationsSection />
    </div>
  );
}

/**
 * Section showing co-author requests on user's papers.
 */
function CoauthorRequestsSection() {
  const { data, isLoading, isError, error, refetch } = useCoauthorRequests();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Co-Author Requests
            </CardTitle>
            <CardDescription>
              People requesting to be added as co-authors to your papers
            </CardDescription>
          </CardHeader>
        </Card>
        <CoauthorRequestCardSkeleton />
        <CoauthorRequestCardSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
          <p className="text-destructive mt-4">Failed to load notifications</p>
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

  const pendingRequests = data?.requests?.filter((r) => r.status === 'pending') ?? [];

  if (pendingRequests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Requests and updates related to your papers</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <Bell className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground mt-4">No pending notifications</p>
          <p className="text-sm text-muted-foreground mt-2">
            When someone requests to be added as a co-author to one of your papers, you will see it
            here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Co-Author Requests
            <Badge variant="secondary">{pendingRequests.length}</Badge>
          </CardTitle>
          <CardDescription>
            People requesting to be added as co-authors to your papers
          </CardDescription>
        </CardHeader>
      </Card>
      {pendingRequests.map((request) => (
        <CoauthorRequestActionCard key={request.id} request={request as CoauthorClaimRequest} />
      ))}
    </div>
  );
}

/**
 * Card with approve/reject actions for a co-author request.
 */
function CoauthorRequestActionCard({ request }: { request: CoauthorClaimRequest }) {
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isUpdatingPds, setIsUpdatingPds] = useState(false);
  const [pdsUpdateError, setPdsUpdateError] = useState<string | null>(null);
  const [approvalComplete, setApprovalComplete] = useState(false);

  const approveCoauthor = useApproveCoauthor();
  const rejectCoauthor = useRejectCoauthor();

  const isProcessing = approveCoauthor.isPending || rejectCoauthor.isPending || isUpdatingPds;

  const handleApprove = async () => {
    setIsApproveDialogOpen(true);
  };

  const confirmApproval = async () => {
    const agent = getCurrentAgent();
    if (!agent) {
      setPdsUpdateError('Not authenticated');
      return;
    }

    try {
      // Step 1: Mark as approved in Chive's database
      await approveCoauthor.mutateAsync({ requestId: request.id });

      // Step 2: Update the eprint record in user's PDS
      setIsUpdatingPds(true);
      setPdsUpdateError(null);

      await addCoauthorToEprint(agent, {
        eprintUri: request.eprintUri,
        authorIndex: request.authorIndex,
        coauthorDid: request.claimantDid,
      });

      setApprovalComplete(true);
      setIsApproveDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update paper';
      setPdsUpdateError(message);
    } finally {
      setIsUpdatingPds(false);
    }
  };

  const handleReject = async () => {
    try {
      await rejectCoauthor.mutateAsync({
        requestId: request.id,
        reason: rejectReason || undefined,
      });
      setIsRejectDialogOpen(false);
      setRejectReason('');
    } catch {
      // Error handled by mutation
    }
  };

  // Show success state after approval
  if (approvalComplete) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="font-medium text-green-900">Co-author added successfully</p>
              <p className="text-sm text-green-700">
                {request.claimantName} has been added as a co-author to your paper.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Request info */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                <p className="font-medium">{request.claimantName}</p>
                <span className="text-muted-foreground">wants to be added as co-author</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Claiming authorship as: <span className="font-medium">{request.authorName}</span>
              </p>
              <p className="text-xs text-muted-foreground truncate">Paper: {request.eprintUri}</p>
              {request.message && (
                <div className="bg-muted/50 rounded p-3 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Message:</p>
                  <p>{request.message}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Requested: {new Date(request.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/eprints/${encodeURIComponent(request.eprintUri)}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Paper
              </Link>
            </Button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleApprove} disabled={isProcessing} className="flex-1">
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Approve Co-Author Request</DialogTitle>
                  <DialogDescription className="space-y-2">
                    <span className="block">
                      Approving will add <span className="font-medium">{request.claimantName}</span>{' '}
                      as a co-author on your paper.
                    </span>
                    <span className="block">
                      This will update your paper record in your PDS to link their account to the
                      author entry &quot;{request.authorName}&quot;.
                    </span>
                  </DialogDescription>
                </DialogHeader>
                {pdsUpdateError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {pdsUpdateError}
                  </div>
                )}
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsApproveDialogOpen(false)}
                    disabled={isUpdatingPds}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmApproval}
                    disabled={isUpdatingPds || approveCoauthor.isPending}
                  >
                    {isUpdatingPds || approveCoauthor.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Approve & Update Paper
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={isProcessing} className="flex-1">
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reject Co-Author Request</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to reject this co-author request from{' '}
                    <span className="font-medium">{request.claimantName}</span>? You can optionally
                    provide a reason.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  placeholder="Optional: Reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="min-h-[80px]"
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={rejectCoauthor.isPending}
                    variant="destructive"
                  >
                    {rejectCoauthor.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Reject Request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Error messages */}
          {approveCoauthor.isError && (
            <p className="text-sm text-destructive">
              Failed to approve: {approveCoauthor.error?.message}
            </p>
          )}
          {rejectCoauthor.isError && (
            <p className="text-sm text-destructive">
              Failed to reject: {rejectCoauthor.error?.message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CoauthorRequestCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// REVIEWS NOTIFICATIONS SECTION
// =============================================================================

/**
 * Section showing recent reviews on the user's papers.
 */
function ReviewsNotificationsSection() {
  const { data, isLoading, isError, error, refetch } = useReviewNotifications({ limit: 20 });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Reviews on Your Papers
          </CardTitle>
          <CardDescription>Recent comments and reviews from the community</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Reviews on Your Papers
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
          <p className="text-destructive mt-4">Failed to load reviews</p>
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

  const notifications = data?.notifications ?? [];

  if (notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Reviews on Your Papers
          </CardTitle>
          <CardDescription>Recent comments and reviews from the community</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground mt-4">No recent reviews</p>
          <p className="text-sm text-muted-foreground mt-2">
            When someone reviews one of your papers, you will see it here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Reviews on Your Papers
          <Badge variant="secondary">{notifications.length}</Badge>
        </CardTitle>
        <CardDescription>Recent comments and reviews from the community</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.uri}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <MessageSquare className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {notification.reviewerDisplayName ?? notification.reviewerHandle ?? 'Someone'}
                </span>
                <span className="text-muted-foreground">
                  {notification.isReply ? 'replied to a review on' : 'reviewed'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {notification.eprintTitle}
              </p>
              <p className="text-sm mt-1 line-clamp-2">{notification.text}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(notification.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/eprints/${encodeURIComponent(notification.eprintUri)}`}>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// ENDORSEMENTS NOTIFICATIONS SECTION
// =============================================================================

/**
 * Maps endorsement type to human-readable label.
 */
function getEndorsementTypeLabel(type: 'methods' | 'results' | 'overall'): string {
  switch (type) {
    case 'methods':
      return 'methods';
    case 'results':
      return 'results';
    case 'overall':
      return 'overall quality';
    default:
      return type;
  }
}

/**
 * Section showing recent endorsements on the user's papers.
 */
function EndorsementsNotificationsSection() {
  const { data, isLoading, isError, error, refetch } = useEndorsementNotifications({ limit: 20 });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5" />
            Endorsements on Your Papers
          </CardTitle>
          <CardDescription>Endorsements from other researchers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5" />
            Endorsements on Your Papers
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
          <p className="text-destructive mt-4">Failed to load endorsements</p>
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

  const notifications = data?.notifications ?? [];

  if (notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5" />
            Endorsements on Your Papers
          </CardTitle>
          <CardDescription>Endorsements from other researchers</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <ThumbsUp className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground mt-4">No recent endorsements</p>
          <p className="text-sm text-muted-foreground mt-2">
            When someone endorses one of your papers, you will see it here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ThumbsUp className="h-5 w-5" />
          Endorsements on Your Papers
          <Badge variant="secondary">{notifications.length}</Badge>
        </CardTitle>
        <CardDescription>Endorsements from other researchers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.uri}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <ThumbsUp className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {notification.endorserDisplayName ?? notification.endorserHandle ?? 'Someone'}
                </span>
                <span className="text-muted-foreground">
                  endorsed the {getEndorsementTypeLabel(notification.endorsementType)} of
                </span>
              </div>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {notification.eprintTitle}
              </p>
              {notification.comment && (
                <p className="text-sm mt-1 line-clamp-2">&quot;{notification.comment}&quot;</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(notification.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/eprints/${encodeURIComponent(notification.eprintUri)}`}>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
