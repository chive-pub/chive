'use client';

import Link from 'next/link';
import {
  FileText,
  MessageSquare,
  ThumbsUp,
  Plus,
  Vote,
  Bell,
  Upload,
  TrendingUp,
  Scroll,
} from 'lucide-react';

import { useCurrentUser } from '@/lib/auth';
import { useEprintsByAuthor } from '@/lib/hooks/use-eprint';
import { useAuthorReviews } from '@/lib/hooks/use-review';
import { useMyEndorsements } from '@/lib/hooks/use-endorsement';
import { useProposals } from '@/lib/hooks/use-governance';
import { useReviewNotifications, useEndorsementNotifications } from '@/lib/hooks/use-notifications';
import { useUserClaims } from '@/lib/hooks/use-claiming';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

/**
 * Dashboard overview page.
 *
 * @remarks
 * Shows user stats, recent activity, and quick actions.
 */
export default function DashboardPage() {
  const user = useCurrentUser();
  const did = user?.did ?? '';

  const { data: eprints, isLoading: eprintsLoading } = useEprintsByAuthor({ did });
  const { data: reviews, isLoading: reviewsLoading } = useAuthorReviews(did, { enabled: !!did });
  const { data: endorsements, isLoading: endorsementsLoading } = useMyEndorsements(did, {
    enabled: !!did,
  });
  const { data: proposals, isLoading: proposalsLoading } = useProposals({ limit: 50 });
  const { data: reviewNotifs, isLoading: reviewNotifsLoading } = useReviewNotifications({
    limit: 20,
  });
  const { data: endorsementNotifs, isLoading: endorsementNotifsLoading } =
    useEndorsementNotifications({ limit: 20 });
  const { data: claims, isLoading: claimsLoading } = useUserClaims({});

  const eprintCount = eprints?.eprints?.length ?? 0;
  const reviewCount = reviews?.total ?? reviews?.reviews?.length ?? 0;
  const endorsementCount = endorsements?.total ?? endorsements?.endorsements?.length ?? 0;
  const myProposals = proposals?.proposals?.filter((p) => p.proposedBy === did) ?? [];
  const notifCount =
    (reviewNotifs?.notifications?.length ?? 0) + (endorsementNotifs?.notifications?.length ?? 0);
  const claimCount = claims?.pages?.flatMap((p) => p.claims)?.length ?? 0;

  const notifsLoading = reviewNotifsLoading || endorsementNotifsLoading;

  // Recent activity: combine reviews and endorsements, sort by date
  const recentReviews = (reviews?.reviews ?? []).slice(0, 3);
  const recentEndorsements = (endorsements?.endorsements ?? []).slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back{user?.displayName ? `, ${user.displayName}` : ''}
        </h1>
        <p className="text-muted-foreground">Manage your eprints, reviews, and endorsements</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3" role="region" aria-label="Your statistics">
        <StatsCard
          title="Eprints"
          value={eprintsLoading ? null : eprintCount}
          description="Authored or co-authored"
          icon={FileText}
          href="/dashboard/eprints"
        />
        <StatsCard
          title="Reviews"
          value={reviewsLoading ? null : reviewCount}
          description="Reviews written"
          icon={MessageSquare}
          href="/dashboard/reviews"
        />
        <StatsCard
          title="Endorsements"
          value={endorsementsLoading ? null : endorsementCount}
          description="Endorsements given"
          icon={ThumbsUp}
          href="/dashboard/endorsements"
        />
        <StatsCard
          title="Proposals"
          value={proposalsLoading ? null : myProposals.length}
          description="Governance proposals"
          icon={Vote}
          href="/dashboard/proposals"
        />
        <StatsCard
          title="Notifications"
          value={notifsLoading ? null : notifCount}
          description="On your papers"
          icon={Bell}
          href="/dashboard/notifications"
        />
        <StatsCard
          title="Imports"
          value={claimsLoading ? null : claimCount}
          description="Papers claimed"
          icon={Upload}
          href="/dashboard/claims"
        />
      </div>

      {/* Quick Actions */}
      <Card role="region" aria-label="Quick actions">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4" role="group" aria-label="Quick actions">
          <Button asChild>
            <Link href="/submit">
              <Plus className="mr-2 h-4 w-4" />
              Submit Eprint
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/claims">
              <Upload className="mr-2 h-4 w-4" />
              Import Papers
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/eprints">
              <FileText className="mr-2 h-4 w-4" />
              Browse Eprints
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/trending">
              <TrendingUp className="mr-2 h-4 w-4" />
              Browse Trending
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/governance/proposals/new">
              <Scroll className="mr-2 h-4 w-4" />
              New Proposal
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card role="region" aria-label="Recent activity">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest reviews and endorsements</CardDescription>
        </CardHeader>
        <CardContent>
          {reviewsLoading || endorsementsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : recentReviews.length === 0 && recentEndorsements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No recent activity. Write a review or endorse a paper to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {recentReviews.map((review) => (
                <Link
                  key={review.uri}
                  href={`/eprints/${encodeURIComponent(review.eprintUri)}`}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Review
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-1 truncate">
                      {review.eprintTitle ?? 'Untitled'}
                    </p>
                    {review.content && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {review.content}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
              {recentEndorsements.map((endorsement) => (
                <Link
                  key={endorsement.uri}
                  href={`/eprints/${encodeURIComponent(endorsement.eprintUri)}`}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <ThumbsUp className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Endorsement
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(endorsement.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-1 truncate">
                      {endorsement.eprintTitle ?? 'Untitled'}
                    </p>
                    {endorsement.comment && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {endorsement.comment}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Stats card component.
 */
function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  href,
}: {
  title: string;
  value: number | null;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        <p className="text-xs text-muted-foreground">{description}</p>
        <Link href={href} className="text-xs text-primary hover:underline mt-2 inline-block">
          View all →
        </Link>
      </CardContent>
    </Card>
  );
}
