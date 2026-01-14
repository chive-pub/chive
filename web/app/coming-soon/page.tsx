import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BookOpen, Shield, Users, GitBranch, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Chive | Decentralized Eprints',
  description: 'Decentralized eprints on ATProto.',
};

const features = [
  {
    icon: Shield,
    title: 'Data Sovereignty',
    description:
      'Your research stays in your control. All data is stored in your Personal Data Server (PDS), not on centralized servers.',
  },
  {
    icon: Users,
    title: 'Open Federation',
    description:
      'Built on AT Protocol for a federated, open ecosystem. Interoperable with Bluesky and future atproto apps.',
  },
  {
    icon: BookOpen,
    title: 'Academic Focus',
    description:
      'Purpose-built for scholarly communication with field-based organization, version control, and DOI support.',
  },
  {
    icon: GitBranch,
    title: 'Open Source',
    description:
      'Fully open source and community-driven. Contribute to the future of decentralized academic publishing.',
  },
];

/**
 * Stopgap landing page for Chive during alpha development.
 * Access at /coming-soon
 */
export default function ComingSoonPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#157200]/5 via-transparent to-transparent" />

        <div className="container flex flex-col items-center justify-center gap-8 py-24 text-center md:py-32 lg:py-40">
          {/* Logo */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-[#157200]/10 blur-2xl" />
              <Image
                src="/chive-logo.svg"
                alt="Chive"
                width={120}
                height={120}
                className="relative"
                priority
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
              Chive
            </h1>
            <p className="text-xl text-muted-foreground sm:text-2xl md:text-3xl">
              Decentralized Eprints
            </p>
          </div>

          {/* Description */}
          <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
            Decentralized eprints on ATProto. Share your research with full data sovereignty, open
            federation, and community governance.
          </p>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#157200]/20 bg-[#157200]/5 px-4 py-2 text-sm font-medium text-[#157200] dark:text-[#4ade80]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#157200] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#157200]" />
            </span>
            Alpha Coming Soon
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button size="lg" asChild className="bg-[#157200] hover:bg-[#125f00]">
              <Link href="https://docs.chive.pub" target="_blank" rel="noopener noreferrer">
                Read the Docs
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link
                href="https://github.com/chive-pub/chive"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-y bg-muted/30 py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                The Future of Academic Publishing
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Built on open protocols, owned by the community
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <Card key={feature.title} className="border-none bg-background/50 backdrop-blur">
                  <CardHeader className="pb-3">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-[#157200]/10">
                      <feature.icon className="h-6 w-6 text-[#157200] dark:text-[#4ade80]" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AT Protocol Section */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Built on AT Protocol</h2>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              Chive is an AppView on the{' '}
              <Link
                href="https://atproto.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#157200] hover:underline dark:text-[#4ade80]"
              >
                Authenticated Transfer Protocol
              </Link>
              , the same decentralized foundation that powers Bluesky. Your eprints, reviews, and
              endorsements live in your Personal Data Server—portable, permanent, and under your
              control.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#157200]" />
                Portable Identity
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#157200]" />
                Federated Network
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#157200]" />
                Algorithmic Choice
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#157200]" />
                No Platform Lock-in
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter/Updates Section */}
      <section className="border-t bg-muted/30 py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Stay Updated</h2>
            <p className="mt-4 text-muted-foreground">
              Follow development progress and be the first to know when alpha access opens.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button variant="outline" size="lg" asChild>
                <Link
                  href="https://bsky.app/profile/chive.pub"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Follow on Bluesky
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="lg" asChild>
                <Link href="https://docs.chive.pub" target="_blank" rel="noopener noreferrer">
                  Documentation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Image src="/chive-logo.svg" alt="Chive" width={24} height={24} />
              <span className="text-sm text-muted-foreground">Chive — Decentralized Eprints</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link
                href="https://docs.chive.pub"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Docs
              </Link>
              <Link
                href="https://github.com/chive-pub/chive"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                GitHub
              </Link>
              <Link
                href="https://bsky.app/profile/chive.pub"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Bluesky
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
