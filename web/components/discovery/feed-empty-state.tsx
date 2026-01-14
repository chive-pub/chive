'use client';

import Link from 'next/link';
import { Sparkles, UserPlus, BookOpen, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Props for FeedEmptyState component.
 */
export interface FeedEmptyStateProps {
  /** Whether the user is authenticated */
  isAuthenticated?: boolean;
  /** Whether the user has linked external accounts */
  hasLinkedAccounts?: boolean;
  /** Whether the user has claimed any papers */
  hasClaimedPapers?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Empty state for the For You feed.
 *
 * @remarks
 * Shows contextual onboarding based on user state:
 * - Not authenticated: prompt to sign in
 * - No linked accounts: prompt to link ORCID/S2
 * - No claimed papers: prompt to claim papers
 * - Has everything: explain cold start
 *
 * @example
 * ```tsx
 * <FeedEmptyState
 *   isAuthenticated={!!user}
 *   hasLinkedAccounts={!!profile?.orcid}
 *   hasClaimedPapers={claimedCount > 0}
 * />
 * ```
 */
export function FeedEmptyState({
  isAuthenticated = false,
  hasLinkedAccounts = false,
  hasClaimedPapers = false,
  className,
}: FeedEmptyStateProps) {
  // Not authenticated
  if (!isAuthenticated) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Personalized Recommendations</CardTitle>
          <CardDescription>
            Sign in to get paper recommendations based on your research interests
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/login">
              Sign in to continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Authenticated but no linked accounts
  if (!hasLinkedAccounts) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Link Your Research Profile</CardTitle>
          <CardDescription>
            Connect your ORCID or Semantic Scholar ID to get personalized recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <Button asChild>
              <Link href="/dashboard/settings">
                Link accounts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Has linked accounts but no claimed papers
  if (!hasClaimedPapers) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Claim Your Papers</CardTitle>
          <CardDescription>
            Import your published papers to improve your recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            We found papers that may be yours based on your linked accounts. Claim them to train
            your personalized feed.
          </p>
          <div className="flex justify-center">
            <Button asChild>
              <Link href="/dashboard/claiming">
                Review papers
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Everything is set up, just cold start
  return (
    <Card className={cn('border-dashed', className)}>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Building Your Feed</CardTitle>
        <CardDescription>
          We&apos;re analyzing your research profile to find relevant papers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          This may take a few minutes. In the meantime, you can browse trending papers or search for
          specific topics.
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/trending">Browse trending</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/search">Search papers</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
