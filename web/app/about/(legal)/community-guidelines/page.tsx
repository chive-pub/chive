import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Community Guidelines',
  description: 'Community Guidelines for Chive, a decentralized eprint service on ATProto.',
};

export default function CommunityGuidelinesPage() {
  return (
    <div className="space-y-10 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Community Guidelines</h1>
        <p className="text-sm text-muted-foreground">Effective date: March 2, 2026</p>
      </header>

      {/* Table of Contents */}
      <nav aria-label="Table of contents" className="rounded-lg border bg-muted/50 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Table of Contents
        </h2>
        <ol className="list-decimal space-y-1 pl-4 text-sm">
          <li>
            <a href="#mission" className="text-primary hover:underline">
              Our Mission
            </a>
          </li>
          <li>
            <a href="#pledge" className="text-primary hover:underline">
              Our Pledge
            </a>
          </li>
          <li>
            <a href="#expected-behavior" className="text-primary hover:underline">
              Expected Behavior
            </a>
          </li>
          <li>
            <a href="#unacceptable-behavior" className="text-primary hover:underline">
              Unacceptable Behavior
            </a>
          </li>
          <li>
            <a href="#content-standards" className="text-primary hover:underline">
              Content Standards
            </a>
          </li>
          <li>
            <a href="#participation" className="text-primary hover:underline">
              Community Participation Levels
            </a>
          </li>
          <li>
            <a href="#enforcement" className="text-primary hover:underline">
              Enforcement
            </a>
          </li>
          <li>
            <a href="#appeals" className="text-primary hover:underline">
              Appeals
            </a>
          </li>
          <li>
            <a href="#scope" className="text-primary hover:underline">
              Scope
            </a>
          </li>
          <li>
            <a href="#attribution" className="text-primary hover:underline">
              Attribution
            </a>
          </li>
          <li>
            <a href="#changes" className="text-primary hover:underline">
              Changes
            </a>
          </li>
        </ol>
      </nav>

      {/* 1. Our Mission */}
      <section id="mission" className="space-y-3">
        <h2 className="text-2xl font-semibold">1. Our Mission</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive exists to advance scholarly communication through decentralized, community-governed
          infrastructure. These guidelines establish expectations for behavior on the platform to
          maintain a productive, inclusive environment for researchers, reviewers, and contributors.
        </p>
      </section>

      {/* 2. Our Pledge */}
      <section id="pledge" className="space-y-3">
        <h2 className="text-2xl font-semibold">2. Our Pledge</h2>
        <p className="text-muted-foreground leading-relaxed">
          We pledge to make participation in Chive a harassment-free experience for everyone,
          regardless of age, body size, disability, ethnicity, sex characteristics, gender identity
          and expression, level of experience, education, socio-economic status, nationality,
          personal appearance, race, religion, or sexual identity and orientation.
        </p>
      </section>

      {/* 3. Expected Behavior */}
      <section id="expected-behavior" className="space-y-3">
        <h2 className="text-2xl font-semibold">3. Expected Behavior</h2>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Use welcoming and inclusive language</li>
          <li>Respect differing viewpoints and experiences</li>
          <li>Accept constructive criticism gracefully</li>
          <li>Engage in scholarly discourse with intellectual honesty</li>
          <li>Focus on what is best for the community</li>
          <li>Show empathy towards other community members</li>
        </ul>
      </section>

      {/* 4. Unacceptable Behavior */}
      <section id="unacceptable-behavior" className="space-y-3">
        <h2 className="text-2xl font-semibold">4. Unacceptable Behavior</h2>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Harassment, trolling, or insulting/derogatory comments</li>
          <li>Personal or political attacks</li>
          <li>Public or private harassment</li>
          <li>Publishing others&apos; private information without explicit permission (doxxing)</li>
          <li>Plagiarism, data fabrication, or research misconduct</li>
          <li>Spam, excessive self-promotion, or off-topic content</li>
          <li>Hate speech or discrimination against any group</li>
          <li>Tag spam (abusive, irrelevant, or excessive tags on eprints)</li>
          <li>
            Authority abuse (creating fake authority records, vandalizing established records, or
            adding offensive variant forms)
          </li>
          <li>
            Facet misuse (deliberately misclassifying eprints with incorrect PMEST facet values)
          </li>
          <li>
            Edit warring (repeatedly reverting knowledge graph edits without seeking consensus)
          </li>
          <li>
            Any other conduct which could reasonably be considered inappropriate in a professional
            academic setting
          </li>
        </ul>
      </section>

      {/* 5. Content Standards */}
      <section id="content-standards" className="space-y-3">
        <h2 className="text-2xl font-semibold">5. Content Standards</h2>

        <h3 className="text-lg font-medium">Eprints</h3>
        <p className="text-muted-foreground leading-relaxed">
          Submissions should be scholarly in nature. Chive is a platform for academic research, not
          a general-purpose publishing tool.
        </p>

        <h3 className="text-lg font-medium">Reviews</h3>
        <p className="text-muted-foreground leading-relaxed">
          Reviews should critique the work, not the person. Focus on methodology, evidence, and
          conclusions.
        </p>
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="text-muted-foreground">
            <strong>Acceptable:</strong> &quot;This paper&apos;s methodology is flawed because the
            sample size is insufficient for the claims made.&quot;
          </p>
          <p className="mt-2 text-muted-foreground">
            <strong>Not acceptable:</strong> &quot;The author clearly doesn&apos;t understand basic
            statistics and should go back to school.&quot;
          </p>
        </div>

        <h3 className="text-lg font-medium">Tags</h3>
        <p className="text-muted-foreground leading-relaxed">
          Tags should be relevant to the eprint they are applied to. Promotional tags, profanity,
          and irrelevant terms are not permitted.
        </p>

        <h3 className="text-lg font-medium">Knowledge Graph</h3>
        <p className="text-muted-foreground leading-relaxed">
          Contributions to the knowledge graph (field proposals, authority records, facet
          classifications) should follow established classification standards. When disagreements
          arise, seek consensus through discussion before making repeated changes.
        </p>
      </section>

      {/* 6. Community Participation Levels */}
      <section id="participation" className="space-y-3">
        <h2 className="text-2xl font-semibold">6. Community Participation Levels</h2>
        <p className="text-muted-foreground leading-relaxed">
          Chive has graduated participation levels, each with increasing permissions:
        </p>
        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="font-medium">Guest</p>
            <p className="text-sm text-muted-foreground">Read and browse eprints.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium">Registered User</p>
            <p className="text-sm text-muted-foreground">
              Submit eprints, write reviews, and add tags.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium">Verified Author</p>
            <p className="text-sm text-muted-foreground">
              Endorse eprints and vote on knowledge graph proposals.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium">Trusted Contributor</p>
            <p className="text-sm text-muted-foreground">
              Propose knowledge graph nodes, approve edits, and propose facet classifications.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium">Moderator</p>
            <p className="text-sm text-muted-foreground">
              Review reports, take moderation actions, and resolve edit disputes.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium">Core Team</p>
            <p className="text-sm text-muted-foreground">
              Policy decisions, governance, and platform administration.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Enforcement */}
      <section id="enforcement" className="space-y-3">
        <h2 className="text-2xl font-semibold">7. Enforcement</h2>

        <h3 className="text-lg font-medium">Reporting</h3>
        <p className="text-muted-foreground leading-relaxed">
          If you experience or witness unacceptable behavior, you can report it through the
          platform&apos;s report mechanism or by emailing{' '}
          <a
            href="mailto:admin@chive.pub"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            admin@chive.pub
          </a>{' '}
          with:
        </p>
        <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
          <li>Your contact information</li>
          <li>Names or identifiers of individuals involved</li>
          <li>Description of the behavior</li>
          <li>Links to relevant content</li>
          <li>Any additional context</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          Reports will be reviewed within 2 business days.
        </p>

        <h3 className="text-lg font-medium">Consequences</h3>
        <p className="text-muted-foreground leading-relaxed">
          Moderators may take escalating action depending on severity and history:
        </p>
        <ol className="list-decimal space-y-2 pl-6 text-muted-foreground">
          <li>
            <strong>Warning</strong> -- a private, written warning explaining the violation.
          </li>
          <li>
            <strong>Content removal</strong> -- the offending content is removed from Chive&apos;s
            index. The content remains in the author&apos;s PDS.
          </li>
          <li>
            <strong>Temporary suspension</strong> -- 7 to 30 day suspension from Chive.
          </li>
          <li>
            <strong>Permanent ban</strong> -- permanent removal from Chive.
          </li>
        </ol>
        <p className="text-muted-foreground leading-relaxed">
          Critical violations (hate speech, research misconduct, plagiarism) may result in immediate
          content removal or suspension without prior warning.
        </p>
      </section>

      {/* 8. Appeals */}
      <section id="appeals" className="space-y-3">
        <h2 className="text-2xl font-semibold">8. Appeals</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you believe a moderation action was made in error, you may submit an appeal to{' '}
          <a
            href="mailto:admin@chive.pub"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            admin@chive.pub
          </a>{' '}
          within 14 days of the action. Include:
        </p>
        <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
          <li>The original report or action reference</li>
          <li>Your reason for appealing</li>
          <li>Any new information relevant to the case</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          Appeals will be reviewed by a different moderator within 7 business days.
        </p>
      </section>

      {/* 9. Scope */}
      <section id="scope" className="space-y-3">
        <h2 className="text-2xl font-semibold">9. Scope</h2>
        <p className="text-muted-foreground leading-relaxed">
          These guidelines apply to all Chive-operated spaces, including:
        </p>
        <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
          <li>The Chive website and application</li>
          <li>Eprint submissions, reviews, and comments</li>
          <li>Knowledge graph contributions and discussions</li>
          <li>Tags and endorsements</li>
          <li>
            The Chive{' '}
            <a
              href="https://github.com/chive-pub/chive"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              GitHub repository
            </a>
          </li>
        </ul>
      </section>

      {/* 10. Attribution */}
      <section id="attribution" className="space-y-3">
        <h2 className="text-2xl font-semibold">10. Attribution</h2>
        <p className="text-muted-foreground leading-relaxed">
          These Community Guidelines are adapted from the{' '}
          <a
            href="https://www.contributor-covenant.org/version/2/1/code_of_conduct/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Contributor Covenant
          </a>
          , version 2.1, with additions specific to scholarly communication and the AT Protocol.
        </p>
      </section>

      {/* 11. Changes */}
      <section id="changes" className="space-y-3">
        <h2 className="text-2xl font-semibold">11. Changes</h2>
        <p className="text-muted-foreground leading-relaxed">
          These guidelines may be updated from time to time. Changes will be posted on this page
          with an updated effective date.
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
              href="/about/privacy"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Privacy Policy
            </Link>
          </li>
        </ul>
      </aside>
    </div>
  );
}
