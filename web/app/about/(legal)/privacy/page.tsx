import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Chive, a decentralized eprint service on ATProto.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-10 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Effective date: March 2, 2026</p>
      </header>

      {/* Table of Contents */}
      <nav aria-label="Table of contents" className="rounded-lg border bg-muted/50 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Table of Contents
        </h2>
        <ol className="list-decimal space-y-1 pl-4 text-sm">
          <li>
            <a href="#introduction" className="text-primary hover:underline">
              Introduction
            </a>
          </li>
          <li>
            <a href="#indexed-data" className="text-primary hover:underline">
              Information We Index from ATProto
            </a>
          </li>
          <li>
            <a href="#operational-data" className="text-primary hover:underline">
              Information from Service Operation
            </a>
          </li>
          <li>
            <a href="#analytics" className="text-primary hover:underline">
              Analytics and Observability
            </a>
          </li>
          <li>
            <a href="#cookies" className="text-primary hover:underline">
              Cookies and Local Storage
            </a>
          </li>
          <li>
            <a href="#how-we-use" className="text-primary hover:underline">
              How We Use Information
            </a>
          </li>
          <li>
            <a href="#sharing" className="text-primary hover:underline">
              Information Sharing
            </a>
          </li>
          <li>
            <a href="#retention" className="text-primary hover:underline">
              Data Retention and Deletion
            </a>
          </li>
          <li>
            <a href="#your-rights" className="text-primary hover:underline">
              Your Rights
            </a>
          </li>
          <li>
            <a href="#security" className="text-primary hover:underline">
              Security
            </a>
          </li>
          <li>
            <a href="#children" className="text-primary hover:underline">
              Children&apos;s Privacy
            </a>
          </li>
          <li>
            <a href="#changes" className="text-primary hover:underline">
              Changes to This Policy
            </a>
          </li>
          <li>
            <a href="#contact" className="text-primary hover:underline">
              Contact
            </a>
          </li>
        </ol>
      </nav>

      {/* 1. Introduction */}
      <section id="introduction" className="space-y-3">
        <h2 className="text-2xl font-semibold">1. Introduction</h2>
        <p className="text-muted-foreground leading-relaxed">
          This Privacy Policy describes what information Chive collects, how it is used, and what
          choices you have. Chive is an{' '}
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
          </a>{' '}
          -- a read-only indexer for scholarly eprints.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          The key principle:{' '}
          <strong>
            your research data lives in your Personal Data Server (PDS), not on Chive&apos;s
            servers.
          </strong>{' '}
          Chive indexes publicly available data from the AT Protocol network to provide search,
          discovery, and display services.
        </p>
      </section>

      {/* 2. Information We Index from ATProto */}
      <section id="indexed-data" className="space-y-3">
        <h2 className="text-2xl font-semibold">2. Information We Index from ATProto</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive indexes data from the AT Protocol firehose, a public data stream of repository
          events. This includes:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>
            <strong>Eprint metadata</strong> -- titles, abstracts, author lists, field
            classifications, keywords, and license information
          </li>
          <li>
            <strong>BlobRef CID pointers</strong> -- cryptographic references to files stored in
            your PDS (such as PDFs). Chive stores only the pointer, never the file itself.
          </li>
          <li>
            <strong>Reviews, endorsements, and comments</strong> -- scholarly feedback submitted by
            users
          </li>
          <li>
            <strong>Knowledge graph contributions</strong> -- field proposals, community votes, and
            tags
          </li>
          <li>
            <strong>AT Protocol identifiers</strong> -- your DID (Decentralized Identifier) and
            handle, which are public identifiers on the AT Protocol network
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          Chive does <strong>not</strong> store blob data (PDFs, images, or other files). We store
          only CID pointers. The actual files remain in your PDS and are served directly from it.
          Chive does not store passwords.
        </p>
      </section>

      {/* 3. Information from Service Operation */}
      <section id="operational-data" className="space-y-3">
        <h2 className="text-2xl font-semibold">3. Information from Service Operation</h2>
        <p className="text-muted-foreground leading-relaxed">
          In addition to data indexed from the AT Protocol, Chive collects the following through
          normal service operation:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>
            <strong>Authentication tokens</strong> -- AT Protocol OAuth session tokens, stored in
            encrypted Redis sessions (AES-256-GCM encryption) with a 7-day expiration. Chive does
            not store passwords or login credentials.
          </li>
          <li>
            <strong>Rate limiting data</strong> -- request counters tied to IP addresses (for
            unauthenticated users) or DIDs (for authenticated users). These counters are stored in
            Redis and automatically expire.
          </li>
        </ul>
      </section>

      {/* 4. Analytics and Observability */}
      <section id="analytics" className="space-y-3">
        <h2 className="text-2xl font-semibold">4. Analytics and Observability</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive uses exclusively self-hosted analytics and observability tools. We do not use any
          third-party SaaS analytics services. No data is sent to Google Analytics, Meta, or any
          other external analytics provider.
        </p>

        <h3 className="text-lg font-medium">Grafana Faro (Frontend)</h3>
        <p className="text-muted-foreground leading-relaxed">
          Collects page load performance metrics (Web Vitals), JavaScript errors, and navigation
          events. User DIDs are hashed before collection using a one-way hash, making them
          non-reversible. Session IDs are randomly generated, non-identifying tokens.
        </p>

        <h3 className="text-lg font-medium">OpenTelemetry (Backend)</h3>
        <p className="text-muted-foreground leading-relaxed">
          Distributed request tracing for debugging and performance monitoring. Traces track request
          timing and database query performance. No personally identifiable information is included
          in traces.
        </p>

        <h3 className="text-lg font-medium">Activity Service</h3>
        <p className="text-muted-foreground leading-relaxed">
          Logs user-initiated write actions (such as &quot;submitted eprint&quot; or &quot;posted
          review&quot;) tied to your DID, used for activity feeds and firehose event correlation.
          Activity logs are cascade-deleted when your account is removed.
        </p>

        <h3 className="text-lg font-medium">Metrics Service</h3>
        <p className="text-muted-foreground leading-relaxed">
          Tracks view counts and download counts per eprint. Uses HyperLogLog for unique viewer
          estimation, which provides approximate counts without identifying individual viewers.
          Trending calculations are based on time-windowed aggregate view counts.
        </p>

        <h3 className="text-lg font-medium">Search Relevance Logging</h3>
        <p className="text-muted-foreground leading-relaxed">
          Records search impressions, result clicks, and dwell time to improve search ranking
          quality. This data is anonymized and used only for training search models.
        </p>
      </section>

      {/* 5. Cookies and Local Storage */}
      <section id="cookies" className="space-y-3">
        <h2 className="text-2xl font-semibold">5. Cookies and Local Storage</h2>
        <p className="text-muted-foreground leading-relaxed">Chive uses:</p>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>
            <strong>Faro session ID</strong> -- a randomly generated token stored in local storage
            for correlating observability events within a browser session. This is not a tracking
            identifier.
          </li>
          <li>
            <strong>OAuth session tokens</strong> -- stored for authentication session management.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          Chive does not use tracking cookies, advertising cookies, or third-party cookies.
        </p>
      </section>

      {/* 6. How We Use Information */}
      <section id="how-we-use" className="space-y-3">
        <h2 className="text-2xl font-semibold">6. How We Use Information</h2>
        <p className="text-muted-foreground leading-relaxed">Information is used to:</p>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Index and display eprints in search results and browse pages</li>
          <li>Authenticate users via AT Protocol OAuth</li>
          <li>
            Moderate content and enforce our{' '}
            <Link
              href="/about/community-guidelines"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Community Guidelines
            </Link>
          </li>
          <li>Improve search quality through relevance logging</li>
          <li>Monitor service health and debug errors</li>
          <li>Calculate trending metrics and view counts</li>
          <li>Prevent abuse through rate limiting</li>
        </ul>
      </section>

      {/* 7. Information Sharing */}
      <section id="sharing" className="space-y-3">
        <h2 className="text-2xl font-semibold">7. Information Sharing</h2>
        <p className="text-muted-foreground leading-relaxed">
          <strong>
            Chive does not sell, rent, or share personal information with third parties.
          </strong>
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Data indexed from the AT Protocol firehose is, by its nature, public. Anyone with access
          to the AT Protocol firehose can independently index the same data.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Chive may disclose information if required by law, such as in response to a valid subpoena
          or court order.
        </p>
      </section>

      {/* 8. Data Retention and Deletion */}
      <section id="retention" className="space-y-3">
        <h2 className="text-2xl font-semibold">8. Data Retention and Deletion</h2>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>
            <strong>Index data</strong> -- retained as long as the corresponding record exists on
            the AT Protocol network. When a record is tombstoned (deleted from your PDS), Chive
            removes it from all indexes upon receiving the tombstone event via the firehose. Records
            are also removed when your PDS returns a 404 during periodic freshness checks.
          </li>
          <li>
            <strong>Authentication sessions</strong> -- encrypted in Redis with a 7-day expiration.
            Automatically deleted when expired.
          </li>
          <li>
            <strong>Rate limiting data</strong> -- stored in Redis with short time-to-live values.
            Automatically expired.
          </li>
          <li>
            <strong>Analytics data</strong> -- retained for service improvement. User DIDs are
            hashed before collection.
          </li>
          <li>
            <strong>Activity logs</strong> -- cascade-deleted when your account is removed from
            Chive.
          </li>
        </ul>
      </section>

      {/* 9. Your Rights */}
      <section id="your-rights" className="space-y-3">
        <h2 className="text-2xl font-semibold">9. Your Rights</h2>
        <p className="text-muted-foreground leading-relaxed">
          Because your data lives in your PDS, you have direct control over it:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>
            <strong>Access</strong> -- you can access your data directly through your PDS provider
            at any time.
          </li>
          <li>
            <strong>Deletion</strong> -- delete records from your PDS and Chive removes them from
            its index.
          </li>
          <li>
            <strong>Portability</strong> -- your data is stored in AT Protocol format in your PDS
            and is inherently portable to any AT Protocol-compatible service.
          </li>
          <li>
            <strong>Correction</strong> -- update records in your PDS and Chive will re-index the
            updated version.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          For any privacy-related requests that cannot be handled through your PDS, contact us at{' '}
          <a
            href="mailto:privacy@chive.pub"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            privacy@chive.pub
          </a>
          .
        </p>
      </section>

      {/* 10. Security */}
      <section id="security" className="space-y-3">
        <h2 className="text-2xl font-semibold">10. Security</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive implements security measures including encrypted session storage (AES-256-GCM),
          mutual TLS for inter-service communication, and secrets management. Personally
          identifiable information is scrubbed from observability data before collection.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          No system is perfectly secure. While we take reasonable measures to protect the Service,
          we cannot guarantee absolute security.
        </p>
      </section>

      {/* 11. Children's Privacy */}
      <section id="children" className="space-y-3">
        <h2 className="text-2xl font-semibold">11. Children&apos;s Privacy</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive is not intended for users under 18 years of age. We do not knowingly collect
          personal information from children under 18. If you believe a child under 18 has provided
          information to Chive, please contact us at{' '}
          <a
            href="mailto:privacy@chive.pub"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            privacy@chive.pub
          </a>
          .
        </p>
      </section>

      {/* 12. Changes to This Policy */}
      <section id="changes" className="space-y-3">
        <h2 className="text-2xl font-semibold">12. Changes to This Policy</h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update this Privacy Policy from time to time. Changes will be posted on this page
          with an updated effective date. Your continued use of the Service after changes are posted
          constitutes your acceptance of the revised policy.
        </p>
      </section>

      {/* 13. Contact */}
      <section id="contact" className="space-y-3">
        <h2 className="text-2xl font-semibold">13. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          For privacy questions or requests, contact us at{' '}
          <a
            href="mailto:privacy@chive.pub"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            privacy@chive.pub
          </a>{' '}
          or through{' '}
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

      {/* Related Documents */}
      <aside className="rounded-lg border bg-muted/50 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Related Documents
        </h2>
        <ul className="space-y-1 text-sm">
          <li>
            <Link
              href="/about/terms"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Terms of Service
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
