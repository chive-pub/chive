import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * About page metadata.
 */
export const metadata: Metadata = {
  title: 'About',
  description: 'Learn about Chive, a decentralized eprint service on ATProto.',
};

/**
 * About page component.
 *
 * @remarks
 * Static page describing the Chive platform and its features.
 */
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 py-8">
      {/* Hero section */}
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">About Chive</h1>
        <p className="mt-4 text-xl text-muted-foreground">Decentralized eprints on ATProto</p>
      </header>

      {/* Mission */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Our Mission</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive aims to revolutionize scholarly communication by building an eprint service where
          researchers truly own their work. Using AT Protocol&apos;s decentralized architecture,
          your eprints live in your Personal Data Server (PDS), not in a central database you
          don&apos;t control.
        </p>
      </section>

      {/* Key Features */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Key Features</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Data Sovereignty</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Your eprints are stored in your PDS. If Chive disappears tomorrow, your work remains
              intact and accessible.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Decentralized Identity</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Use your existing AT Protocol identity (like Bluesky) or create a new one. Link your
              ORCID for enhanced academic identity.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Open Peer Review</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Transparent, threaded reviews with unlimited depth. All reviews are signed and
              attributable to their authors.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Knowledge Graph</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Explore research through our 10-dimensional faceted classification system based on
              PMEST and FAST taxonomies.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Community Governance</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Wikipedia-style moderation for the knowledge graph. Propose new fields, vote on
              changes, and help curate scholarship.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Endorsements</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Formal endorsements categorized by contribution type, derived from the CRediT taxonomy
              for research contributions.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Technology */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Technology</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive is built as an <strong>AppView</strong> on AT Protocol. We index eprints from the AT
          Protocol firehose but never store your data as the source of truth. If our entire database
          were deleted, all eprints would still exist in their owners&apos; Personal Data Servers.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="rounded-full bg-muted px-3 py-1 text-sm">AT Protocol</span>
          <span className="rounded-full bg-muted px-3 py-1 text-sm">TypeScript</span>
          <span className="rounded-full bg-muted px-3 py-1 text-sm">Next.js</span>
          <span className="rounded-full bg-muted px-3 py-1 text-sm">PostgreSQL</span>
          <span className="rounded-full bg-muted px-3 py-1 text-sm">Elasticsearch</span>
          <span className="rounded-full bg-muted px-3 py-1 text-sm">Neo4j</span>
        </div>
      </section>

      {/* Open Source */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Open Source</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive is open source software. We believe in transparency and community-driven
          development. Contributions are welcome!
        </p>
        <div className="flex gap-4">
          <Button asChild variant="outline">
            <a href="https://github.com/chive-pub/chive" target="_blank" rel="noopener noreferrer">
              View on GitHub
            </a>
          </Button>
        </div>
      </section>

      {/* Get Started */}
      <section className="rounded-lg bg-muted/50 p-8 text-center">
        <h2 className="text-2xl font-semibold">Ready to Get Started?</h2>
        <p className="mt-2 text-muted-foreground">
          Start exploring eprints or submit your own research
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Button asChild>
            <Link href="/browse">Browse Eprints</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/submit">Submit an Eprint</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
