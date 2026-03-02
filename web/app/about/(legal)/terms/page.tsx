import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Chive, a decentralized eprint service on ATProto.',
};

export default function TermsOfServicePage() {
  return (
    <div className="space-y-10 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Effective date: March 2, 2026</p>
      </header>

      {/* Table of Contents */}
      <nav aria-label="Table of contents" className="rounded-lg border bg-muted/50 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Table of Contents
        </h2>
        <ol className="list-decimal space-y-1 pl-4 text-sm">
          <li>
            <a href="#acceptance" className="text-primary hover:underline">
              Acceptance of Terms
            </a>
          </li>
          <li>
            <a href="#what-is-chive" className="text-primary hover:underline">
              What Chive Is
            </a>
          </li>
          <li>
            <a href="#eligibility" className="text-primary hover:underline">
              Eligibility
            </a>
          </li>
          <li>
            <a href="#account" className="text-primary hover:underline">
              Account and Authentication
            </a>
          </li>
          <li>
            <a href="#acceptable-use" className="text-primary hover:underline">
              Acceptable Use
            </a>
          </li>
          <li>
            <a href="#intellectual-property" className="text-primary hover:underline">
              Intellectual Property
            </a>
          </li>
          <li>
            <a href="#moderation" className="text-primary hover:underline">
              Content Moderation
            </a>
          </li>
          <li>
            <a href="#deletion" className="text-primary hover:underline">
              Data and Deletion
            </a>
          </li>
          <li>
            <a href="#decentralized-network" className="text-primary hover:underline">
              The Decentralized Network
            </a>
          </li>
          <li>
            <a href="#availability" className="text-primary hover:underline">
              Service Availability
            </a>
          </li>
          <li>
            <a href="#disclaimers" className="text-primary hover:underline">
              Disclaimers
            </a>
          </li>
          <li>
            <a href="#liability" className="text-primary hover:underline">
              Limitation of Liability
            </a>
          </li>
          <li>
            <a href="#governing-law" className="text-primary hover:underline">
              Governing Law
            </a>
          </li>
          <li>
            <a href="#changes" className="text-primary hover:underline">
              Changes to Terms
            </a>
          </li>
          <li>
            <a href="#contact" className="text-primary hover:underline">
              Contact
            </a>
          </li>
        </ol>
      </nav>

      {/* 1. Acceptance of Terms */}
      <section id="acceptance" className="space-y-3">
        <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
        <p className="text-muted-foreground leading-relaxed">
          By accessing or using Chive (&quot;the Service&quot;), you agree to be bound by these
          Terms of Service. If you do not agree to these terms, do not use the Service.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          These terms also incorporate our{' '}
          <Link
            href="/about/privacy"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link
            href="/about/community-guidelines"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Community Guidelines
          </Link>
          .
        </p>
      </section>

      {/* 2. What Chive Is */}
      <section id="what-is-chive" className="space-y-3">
        <h2 className="text-2xl font-semibold">2. What Chive Is</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive is an{' '}
          <a
            href="https://atproto.com/guides/applications"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            AppView
          </a>{' '}
          on the{' '}
          <a
            href="https://atproto.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            AT Protocol
          </a>
          . It is a read-only indexer for scholarly eprints. This means:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>
            <strong>Your data lives in your Personal Data Server (PDS), not on Chive.</strong> Chive
            reads data from the AT Protocol firehose and indexes it for search and display.
          </li>
          <li>
            <strong>Chive never writes to your PDS.</strong> All record creation, updates, and
            deletions originate from you through your PDS.
          </li>
          <li>
            <strong>Chive stores index data and BlobRef CID pointers only.</strong> We never store
            the actual files (PDFs, images). Those remain in your PDS and are served directly from
            it.
          </li>
          <li>
            <strong>If Chive&apos;s database were deleted, you would lose nothing.</strong> Your
            eprints, reviews, and all other records remain in your PDS.
          </li>
        </ul>
      </section>

      {/* 3. Eligibility */}
      <section id="eligibility" className="space-y-3">
        <h2 className="text-2xl font-semibold">3. Eligibility</h2>
        <p className="text-muted-foreground leading-relaxed">
          You must be at least 18 years old to use Chive. By using the Service, you represent and
          warrant that you meet this age requirement.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          During the alpha period, access to certain features may require approval from the Chive
          team.
        </p>
      </section>

      {/* 4. Account and Authentication */}
      <section id="account" className="space-y-3">
        <h2 className="text-2xl font-semibold">4. Account and Authentication</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive uses{' '}
          <a
            href="https://atproto.com/specs/oauth"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            AT Protocol OAuth
          </a>{' '}
          for authentication. Chive does not create accounts, manage passwords, or store login
          credentials. Your AT Protocol identity (DID) is managed by your PDS provider.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          You are responsible for maintaining the security of your PDS credentials and for all
          activity that occurs through your authenticated sessions on Chive.
        </p>
      </section>

      {/* 5. Acceptable Use */}
      <section id="acceptable-use" className="space-y-3">
        <h2 className="text-2xl font-semibold">5. Acceptable Use</h2>
        <p className="text-muted-foreground leading-relaxed">When using Chive, you agree not to:</p>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Submit plagiarized or fraudulent content</li>
          <li>Fabricate or falsify research data</li>
          <li>Engage in harassment, hate speech, or personal attacks</li>
          <li>Submit spam, excessive self-promotion, or off-topic content</li>
          <li>Publish others&apos; private information without their consent</li>
          <li>
            Abuse the knowledge graph (tag spam, edit warring, authority vandalism, facet misuse)
          </li>
          <li>Attempt to circumvent access controls or security measures</li>
          <li>Interfere with the operation of the Service</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          For detailed behavioral expectations, see our{' '}
          <Link
            href="/about/community-guidelines"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Community Guidelines
          </Link>
          .
        </p>
      </section>

      {/* 6. Intellectual Property */}
      <section id="intellectual-property" className="space-y-3">
        <h2 className="text-2xl font-semibold">6. Intellectual Property</h2>
        <p className="text-muted-foreground leading-relaxed">
          You retain all rights to content you submit through your PDS. By making content available
          on the AT Protocol, you grant Chive a non-exclusive, royalty-free license to index,
          display, and serve your content as part of the AppView.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Content displayed on Chive is shown under whatever license you assign to it (for example,
          CC BY 4.0). Chive does not claim ownership of your work.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Chive&apos;s own software is open source and available on{' '}
          <a
            href="https://github.com/chive-pub/chive"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            GitHub
          </a>
          .
        </p>
      </section>

      {/* 7. Content Moderation */}
      <section id="moderation" className="space-y-3">
        <h2 className="text-2xl font-semibold">7. Content Moderation</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive may remove content from its index if it violates these Terms or our{' '}
          <Link
            href="/about/community-guidelines"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Community Guidelines
          </Link>
          . Removal from the Chive index does not delete content from your PDS. Your data remains
          under your control.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Chive uses a combination of community moderation (Wikipedia-style for the knowledge graph)
          and moderator review. You may appeal moderation decisions as described in our Community
          Guidelines.
        </p>
      </section>

      {/* 8. Data and Deletion */}
      <section id="deletion" className="space-y-3">
        <h2 className="text-2xl font-semibold">8. Data and Deletion</h2>
        <p className="text-muted-foreground leading-relaxed">
          When you delete a record from your PDS, the AT Protocol issues a tombstone event. Chive
          removes the corresponding entry from all of its indexes (search, metadata, knowledge
          graph) upon receiving the tombstone via the firehose.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Chive also removes content when your PDS returns a 404 response during periodic freshness
          checks.
        </p>
      </section>

      {/* 9. The Decentralized Network */}
      <section id="decentralized-network" className="space-y-3">
        <h2 className="text-2xl font-semibold">9. The Decentralized Network</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive operates on the AT Protocol, a decentralized network. Other services (AppViews,
          relays, and third-party applications) may independently index the same public content from
          the AT Protocol firehose. Chive cannot control, and is not responsible for, how
          third-party services handle your data.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Deleting content from your PDS removes it from Chive, but other AT Protocol services that
          have indexed the same content may retain their own copies.
        </p>
      </section>

      {/* 10. Service Availability */}
      <section id="availability" className="space-y-3">
        <h2 className="text-2xl font-semibold">10. Service Availability</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive is an open source project provided on a best-effort basis. We do not guarantee
          uptime, availability, or completeness of the index. The Service may be modified,
          suspended, or discontinued at any time.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Because your data lives in your PDS, discontinuation of Chive does not result in loss of
          your data.
        </p>
      </section>

      {/* 11. Disclaimers */}
      <section id="disclaimers" className="space-y-3">
        <h2 className="text-2xl font-semibold">11. Disclaimers</h2>
        <p className="text-muted-foreground leading-relaxed uppercase">
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties
          of any kind, whether express or implied, including but not limited to implied warranties
          of merchantability, fitness for a particular purpose, and non-infringement.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Chive does not guarantee the accuracy, completeness, or reliability of any indexed
          content. Chive is not responsible for the content submitted by users through their
          Personal Data Servers.
        </p>
      </section>

      {/* 12. Limitation of Liability */}
      <section id="liability" className="space-y-3">
        <h2 className="text-2xl font-semibold">12. Limitation of Liability</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive is an open source project without a formal legal entity. To the maximum extent
          permitted by applicable law, the project maintainers shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages, or any loss of profits or
          revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or
          other intangible losses resulting from your use of the Service.
        </p>
      </section>

      {/* 13. Governing Law */}
      <section id="governing-law" className="space-y-3">
        <h2 className="text-2xl font-semibold">13. Governing Law</h2>
        <p className="text-muted-foreground leading-relaxed">
          These Terms shall be governed by and construed in accordance with the laws of the State of
          New York, United States, without regard to its conflict of law provisions. Any disputes
          arising under these Terms shall be resolved in the courts of the State of New York.
        </p>
      </section>

      {/* 14. Changes to Terms */}
      <section id="changes" className="space-y-3">
        <h2 className="text-2xl font-semibold">14. Changes to Terms</h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update these Terms from time to time. Changes will be posted on this page with an
          updated effective date. Your continued use of the Service after changes are posted
          constitutes your acceptance of the revised Terms.
        </p>
      </section>

      {/* 15. Contact */}
      <section id="contact" className="space-y-3">
        <h2 className="text-2xl font-semibold">15. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          For questions about these Terms, contact the project maintainers through{' '}
          <a
            href="https://github.com/chive-pub/chive"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            GitHub
          </a>{' '}
          or email at{' '}
          <a
            href="mailto:legal@chive.pub"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            legal@chive.pub
          </a>
          .
        </p>
      </section>

      {/* Related Documents */}
      <aside className="rounded-lg border bg-muted/50 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Related Documents
        </h2>
        <ul className="space-y-1 text-sm">
          <li>
            <Link
              href="/about/privacy"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Privacy Policy
            </Link>
          </li>
          <li>
            <Link
              href="/about/community-guidelines"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Community Guidelines
            </Link>
          </li>
        </ul>
      </aside>
    </div>
  );
}
