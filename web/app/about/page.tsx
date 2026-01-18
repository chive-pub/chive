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

      {/* What is Chive */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">What is Chive?</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive is an eprint service built on{' '}
          <a
            href="https://atproto.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            AT Protocol
          </a>
          . Your eprints live in your Personal Data Server (PDS), not ours. We index and display
          them, but you control the data.
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
              intact and accessible. Chive is an{' '}
              <a
                href="https://atproto.com/guides/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                AppView
              </a>
              —we index data but never own it.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Decentralized Identity</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Use your existing AT Protocol identity (like{' '}
              <a
                href="https://bsky.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Bluesky
              </a>
              ) or create a new one. Link your{' '}
              <a
                href="https://orcid.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                ORCID
              </a>{' '}
              for enhanced academic identity verification.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Open Peer Review</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Transparent, threaded{' '}
              <Link
                href="/dashboard/reviews"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                reviews
              </Link>{' '}
              with unlimited depth. All reviews are signed and attributable to their authors.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Knowledge Graph</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Explore research through our{' '}
              <Link
                href="/graph"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                knowledge graph
              </Link>
              —a community-curated taxonomy of{' '}
              <Link
                href="/fields"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                fields
              </Link>
              , institutions, and concepts linked to{' '}
              <a
                href="https://www.wikidata.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Wikidata
              </a>
              .
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Community Governance</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Wikipedia-style moderation for the knowledge graph.{' '}
              <Link
                href="/governance/proposals/new"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Propose new nodes
              </Link>
              ,{' '}
              <Link
                href="/governance/proposals"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                vote on changes
              </Link>
              , and help curate scholarship.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Endorsements</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Formal{' '}
              <Link
                href="/dashboard/endorsements"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                endorsements
              </Link>{' '}
              categorized by contribution type, derived from the{' '}
              <a
                href="https://credit.niso.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                CRediT taxonomy
              </a>{' '}
              for research contributions.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tagging</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Add{' '}
              <Link
                href="/tags"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                tags
              </Link>{' '}
              to eprints to help others discover related work. Popular tags can be promoted to
              official taxonomy terms through governance.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Discovery</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Find research through{' '}
              <Link
                href="/search"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                full-text search
              </Link>
              , browse{' '}
              <Link
                href="/trending"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                trending eprints
              </Link>
              , or explore by{' '}
              <Link
                href="/authors"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                author
              </Link>{' '}
              and{' '}
              <Link
                href="/fields"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                field
              </Link>
              .
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Technology */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Technology</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive is built as an{' '}
          <a
            href="https://atproto.com/guides/applications"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            AppView
          </a>{' '}
          on AT Protocol. We index eprints from the AT Protocol firehose but never store your data
          as the source of truth. If our entire database were deleted, all eprints would still exist
          in their owners&apos; Personal Data Servers.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <a
            href="https://atproto.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-muted px-3 py-1 text-sm hover:bg-muted/80"
          >
            AT Protocol
          </a>
          <span className="rounded-full bg-muted px-3 py-1 text-sm">TypeScript</span>
          <a
            href="https://nextjs.org"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-muted px-3 py-1 text-sm hover:bg-muted/80"
          >
            Next.js
          </a>
          <a
            href="https://www.postgresql.org"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-muted px-3 py-1 text-sm hover:bg-muted/80"
          >
            PostgreSQL
          </a>
          <a
            href="https://www.elastic.co/elasticsearch"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-muted px-3 py-1 text-sm hover:bg-muted/80"
          >
            Elasticsearch
          </a>
          <a
            href="https://neo4j.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-muted px-3 py-1 text-sm hover:bg-muted/80"
          >
            Neo4j
          </a>
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
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Button asChild>
            <Link href="/browse">Browse Eprints</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/submit">Submit an Eprint</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/governance">View Governance</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
