'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, MessageSquare, ThumbsUp, Plus } from 'lucide-react';

import { useCurrentUser } from '@/lib/auth';
import { useEprintsByAuthor } from '@/lib/hooks/use-eprint';
import { useUserClaims } from '@/lib/hooks/use-claiming';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ForYouFeed } from '@/components/discovery/for-you-feed';

/**
 * Dashboard overview page.
 *
 * @remarks
 * Shows user stats, recent activity, and quick actions.
 */
export default function DashboardPage() {
  const user = useCurrentUser();
  const { data: eprints, isLoading } = useEprintsByAuthor({ did: user?.did ?? '' });
  const { data: claims } = useUserClaims({ did: user?.did ?? '' });

  const eprintCount = eprints?.eprints?.length ?? 0;

  // Check if user has claimed papers (from API or localStorage for testing)
  const hasClaimedPapersFromApi = (claims?.pages?.[0]?.claims?.length ?? 0) > 0;
  // Check if user has linked accounts (ORCID, Semantic Scholar, etc.)
  // TODO: Add orcid/semanticScholarId to ChiveUser type when implementing account linking
  const hasLinkedAccountsFromApi = false;

  // Support localStorage override for E2E testing
  const [hasLinkedAccounts, setHasLinkedAccounts] = useState(hasLinkedAccountsFromApi);
  const [hasClaimedPapers, setHasClaimedPapers] = useState(hasClaimedPapersFromApi);

  useEffect(() => {
    // Check localStorage for test profile state
    const testProfile = localStorage.getItem('chive:userProfile');
    if (testProfile) {
      try {
        const profile = JSON.parse(testProfile);
        if (profile.hasLinkedAccounts !== undefined) {
          setHasLinkedAccounts(profile.hasLinkedAccounts);
        } else {
          setHasLinkedAccounts(hasLinkedAccountsFromApi);
        }
        if (profile.hasClaimedPapers !== undefined) {
          setHasClaimedPapers(profile.hasClaimedPapers);
        } else {
          setHasClaimedPapers(hasClaimedPapersFromApi);
        }
      } catch {
        // Invalid JSON, use API values
        setHasLinkedAccounts(hasLinkedAccountsFromApi);
        setHasClaimedPapers(hasClaimedPapersFromApi);
      }
    } else {
      // No test profile, use API values
      setHasLinkedAccounts(hasLinkedAccountsFromApi);
      setHasClaimedPapers(hasClaimedPapersFromApi);
    }
  }, [hasLinkedAccountsFromApi, hasClaimedPapersFromApi]);

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
          value={isLoading ? null : eprintCount}
          description="Authored or co-authored"
          icon={FileText}
          href="/dashboard/eprints"
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
              Submit Eprint
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/eprints">Browse Eprints</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/browse">Faceted Search</Link>
          </Button>
        </CardContent>
      </Card>

      {/* For You Feed - Personalized Recommendations */}
      <section role="region" aria-label="For You recommendations">
        <div className="mb-4">
          <h2 className="text-2xl font-bold tracking-tight">For You</h2>
          <p className="text-muted-foreground">Personalized paper recommendations</p>
        </div>
        <ForYouFeed
          isAuthenticated={!!user}
          hasLinkedAccounts={hasLinkedAccounts}
          hasClaimedPapers={hasClaimedPapers}
        />
      </section>
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
