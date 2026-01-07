'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Shield,
  Users,
  Layout,
  Upload,
  Vote,
  MessageSquare,
  Sparkles,
  Loader2,
} from 'lucide-react';

import { useIsAuthenticated } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QuickActionCard } from '@/components/landing/quick-action-card';
import { ForYouFeed } from '@/components/discovery/for-you-feed';
import { useUserProfileState } from '@/lib/hooks/use-discovery';
import { useAlphaStatus } from '@/lib/hooks/use-alpha-status';
import { AlphaSignupForm } from '@/components/alpha/signup-form';
import { AlphaStatusDisplay } from '@/components/alpha/status-display';

const features = [
  {
    icon: Shield,
    title: 'Data Sovereignty',
    description:
      'Your research stays in your control. All data is stored in your Personal Data Server (PDS), not on our servers.',
  },
  {
    icon: Users,
    title: 'Open Community',
    description:
      'Built on AT Protocol for a federated, open ecosystem. No vendor lock-in, full interoperability.',
  },
  {
    icon: BookOpen,
    title: 'Academic Focus',
    description:
      'Designed for scholarly communication with field-based organization, version control, and DOI support.',
  },
];

const quickActions = [
  {
    href: '/dashboard',
    icon: Layout,
    label: 'Dashboard',
    description: 'Your activity hub',
  },
  {
    href: '/submit',
    icon: Upload,
    label: 'Submit Preprint',
    description: 'Share your research',
  },
  {
    href: '/governance',
    icon: Vote,
    label: 'Governance',
    description: 'Proposals and voting',
  },
  {
    href: '/dashboard/reviews',
    icon: MessageSquare,
    label: 'My Reviews',
    description: 'Your contributions',
  },
];

/**
 * Marketing content shown to unauthenticated users.
 */
function MarketingContent() {
  return (
    <>
      {/* Hero Section */}
      <section className="container flex flex-col items-center justify-center gap-6 py-24 text-center md:py-32">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Decentralized
          <br />
          <span className="text-muted-foreground">Preprints</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
          Share your research on an open protocol. Your data stays in your control with AT Protocol.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/preprints">
              Browse Preprints
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/about">Learn More</Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">Why Chive?</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="mb-2 h-10 w-10 text-muted-foreground" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/50 py-16 md:py-24">
        <div className="container text-center">
          <h2 className="mb-4 text-2xl font-bold tracking-tight md:text-3xl">
            Ready to share your research?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
            Join the decentralized academic community. Your work, your data, your control.
          </p>
          <Button size="lg" asChild>
            <Link href="/login">
              Sign In to Apply
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

/**
 * Alpha signup content shown to authenticated users without an application.
 */
function AlphaSignupContent() {
  return (
    <section className="container py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Welcome to Chive
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Chive is currently in alpha. Apply for early access to help shape the future of
            decentralized scholarly communication.
          </p>
        </div>
        <AlphaSignupForm />
      </div>
    </section>
  );
}

/**
 * Alpha status content shown to users with pending/rejected applications.
 */
function AlphaStatusContent({
  status,
  appliedAt,
  reviewedAt,
}: {
  status: 'pending' | 'rejected';
  appliedAt?: string;
  reviewedAt?: string;
}) {
  return (
    <section className="container py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <AlphaStatusDisplay status={status} appliedAt={appliedAt} reviewedAt={reviewedAt} />
      </div>
    </section>
  );
}

/**
 * Full app content shown to approved alpha testers.
 */
function ApprovedAlphaContent({
  hasLinkedAccounts,
  hasClaimedPapers,
}: {
  hasLinkedAccounts: boolean;
  hasClaimedPapers: boolean;
}) {
  return (
    <>
      {/* Hero Section */}
      <section className="container flex flex-col items-center justify-center gap-6 py-24 text-center md:py-32">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Decentralized
          <br />
          <span className="text-muted-foreground">Preprints</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
          Share your research on an open protocol. Your data stays in your control with AT Protocol.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/preprints">
              Browse Preprints
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/about">Learn More</Link>
          </Button>
        </div>
      </section>

      {/* For You Feed Section */}
      <section className="border-y bg-muted/50 py-8" aria-label="For You recommendations">
        <div className="container">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">For You</h2>
          </div>
          <ForYouFeed
            isAuthenticated={true}
            hasLinkedAccounts={hasLinkedAccounts}
            hasClaimedPapers={hasClaimedPapers}
            limit={5}
          />
        </div>
      </section>

      {/* Quick Access Section */}
      <section className="py-8">
        <div className="container">
          <h2 className="mb-6 text-lg font-semibold">Quick Access</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {quickActions.map((action) => (
              <QuickActionCard
                key={action.href}
                href={action.href}
                icon={action.icon}
                label={action.label}
                description={action.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">Why Chive?</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="mb-2 h-10 w-10 text-muted-foreground" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/50 py-16 md:py-24">
        <div className="container text-center">
          <h2 className="mb-4 text-2xl font-bold tracking-tight md:text-3xl">
            Ready to share your research?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
            Join the decentralized academic community. Your work, your data, your control.
          </p>
          <Button size="lg" asChild>
            <Link href="/submit">
              Submit a Preprint
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

/**
 * Loading state while checking alpha status.
 */
function LoadingState() {
  return (
    <section className="container flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </section>
  );
}

export default function HomePage() {
  const isAuthenticated = useIsAuthenticated();
  const { data: alphaStatus, isLoading: isAlphaLoading } = useAlphaStatus({
    enabled: isAuthenticated,
  });
  const { data: profileState } = useUserProfileState({ enabled: isAuthenticated });

  // Unauthenticated users see the marketing page
  if (!isAuthenticated) {
    return (
      <main className="flex-1">
        <MarketingContent />
      </main>
    );
  }

  // Loading state while checking alpha status
  if (isAlphaLoading) {
    return (
      <main className="flex-1">
        <LoadingState />
      </main>
    );
  }

  // No application yet - show signup form
  if (!alphaStatus || alphaStatus.status === 'none') {
    return (
      <main className="flex-1">
        <AlphaSignupContent />
      </main>
    );
  }

  // Pending application - show status
  if (alphaStatus.status === 'pending') {
    return (
      <main className="flex-1">
        <AlphaStatusContent status="pending" appliedAt={alphaStatus.appliedAt} />
      </main>
    );
  }

  // Rejected application - show status
  if (alphaStatus.status === 'rejected') {
    return (
      <main className="flex-1">
        <AlphaStatusContent
          status="rejected"
          appliedAt={alphaStatus.appliedAt}
          reviewedAt={alphaStatus.reviewedAt}
        />
      </main>
    );
  }

  // Approved alpha tester - show full app
  return (
    <main className="flex-1">
      <ApprovedAlphaContent
        hasLinkedAccounts={profileState?.hasLinkedAccounts ?? false}
        hasClaimedPapers={profileState?.hasClaimedPapers ?? false}
      />
    </main>
  );
}
