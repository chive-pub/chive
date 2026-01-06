'use client';

import Link from 'next/link';
import { FileText, MessageSquare, ThumbsUp, Plus } from 'lucide-react';

import { useCurrentUser } from '@/lib/auth';
import { usePreprintsByAuthor } from '@/lib/hooks/use-preprint';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Dashboard overview page.
 *
 * @remarks
 * Shows user stats, recent activity, and quick actions.
 */
export default function DashboardPage() {
  const user = useCurrentUser();
  const { data: preprints, isLoading } = usePreprintsByAuthor({ did: user?.did ?? '' });

  const preprintCount = preprints?.preprints?.length ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back{user?.displayName ? `, ${user.displayName}` : ''}
        </h1>
        <p className="text-muted-foreground">Manage your preprints, reviews, and endorsements</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3" role="region" aria-label="Your statistics">
        <StatsCard
          title="Preprints"
          value={isLoading ? null : preprintCount}
          description="Authored or co-authored"
          icon={FileText}
          href="/dashboard/preprints"
        />
        <StatsCard
          title="Reviews"
          value={isLoading ? null : 0}
          description="Reviews written"
          icon={MessageSquare}
          href="/dashboard/reviews"
        />
        <StatsCard
          title="Endorsements"
          value={isLoading ? null : 0}
          description="Endorsements given"
          icon={ThumbsUp}
          href="/dashboard/endorsements"
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
              Submit Preprint
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/preprints">Browse Preprints</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/browse">Faceted Search</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity Placeholder */}
      <Card role="feed" aria-label="Recent activity">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest interactions on Chive</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Activity feed coming soon
          </p>
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
