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
} from 'lucide-react';

import { useIsAuthenticated } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QuickActionCard } from '@/components/landing/quick-action-card';
import { ForYouFeed } from '@/components/discovery/for-you-feed';
import { useUserProfileState } from '@/lib/hooks/use-discovery';

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

export default function HomePage() {
  const isAuthenticated = useIsAuthenticated();
  const { data: profileState } = useUserProfileState({ enabled: isAuthenticated });

  return (
    <main className="flex-1">
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

      {/* For You Feed Section (Authenticated Users) */}
      {isAuthenticated && (
        <section className="border-y bg-muted/50 py-8" aria-label="For You recommendations">
          <div className="container">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">For You</h2>
            </div>
            <ForYouFeed
              isAuthenticated={isAuthenticated}
              hasLinkedAccounts={profileState?.hasLinkedAccounts ?? false}
              hasClaimedPapers={profileState?.hasClaimedPapers ?? false}
              limit={5}
            />
          </div>
        </section>
      )}

      {/* Quick Access Section (Authenticated Users Only) */}
      {isAuthenticated && (
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
      )}

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
    </main>
  );
}
