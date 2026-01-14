# Alpha and Beta Testing Rollout Plan

> **Note**: This is a planning document. Some sections describe planned infrastructure that has not yet been implemented. The current deployment uses a single-server Docker Compose setup (`docker/docker-compose.prod.yml`).

This document details the comprehensive strategy for rolling out Chive through alpha and beta testing phases, following industry-standard practices for software quality assurance.

## Table of Contents

1. [Overview](#overview)
2. [Infrastructure](#infrastructure)
3. [Testing Phase Definitions](#testing-phase-definitions)
4. [Alpha Testing](#alpha-testing)
5. [Alpha Signup Landing Page](#alpha-signup-landing-page)
6. [Governance PDS](#governance-pds)
7. [Bluesky Advertisement Strategy](#bluesky-advertisement-strategy)
8. [Beta Testing](#beta-testing)
9. [Tester Recruitment](#tester-recruitment)
10. [Bug Reporting System](#bug-reporting-system)
11. [Metrics and Success Criteria](#metrics-and-success-criteria)
12. [Timeline and Milestones](#timeline-and-milestones)
13. [Legal and Compliance](#legal-and-compliance)

---

## Overview

### Purpose

Pre-release testing validates that Chive meets quality standards, identifies defects before general availability, and gathers user feedback to improve the product. Given Chive's role as a decentralized eprint service on AT Protocol, testing must validate both technical correctness and scholarly workflow usability.

### Testing Philosophy

- **Fail fast**: Identify critical issues early when they're cheaper to fix
- **Real-world conditions**: Test with actual scholarly workflows, not just synthetic data
- **Diverse perspectives**: Include researchers across disciplines, career stages, and technical backgrounds
- **ATProto compliance**: Validate data sovereignty and federation behavior throughout
- **Native experience**: Leverage ATProto identity for seamless onboarding—testers sign up with their existing Bluesky handle or DID

---

## Infrastructure

The current deployment uses a single-server Docker Compose setup. See `docker/docker-compose.prod.yml` for the production configuration.

### Services

All services run on a single server via Docker Compose:

- **chive-api**: Hono API server (XRPC + REST)
- **chive-web**: Next.js frontend
- **chive-indexer**: Firehose consumer
- **governance-pds**: ATProto PDS for governance records
- **postgres**: PostgreSQL for metadata
- **elasticsearch**: Full-text search
- **neo4j**: Knowledge graph
- **redis**: Caching and rate limiting

### Deployment

```bash
# Start all services
docker compose -f docker/docker-compose.prod.yml up -d

# View logs
docker compose -f docker/docker-compose.prod.yml logs -f
```

See [Deployment](./deployment.md) for detailed instructions.

---

## Testing Phase Definitions

| Phase           | Audience                 | Duration   | Focus                                             | Bug Tolerance |
| --------------- | ------------------------ | ---------- | ------------------------------------------------- | ------------- |
| **Internal QA** | Development team         | Ongoing    | Unit/integration tests, CI/CD                     | N/A           |
| **Alpha**       | 20-50 invited testers    | 6-8 weeks  | Core functionality, stability, ATProto compliance | High          |
| **Closed Beta** | 200-500 approved testers | 8-12 weeks | UX, edge cases, scale, federation                 | Medium        |
| **Open Beta**   | Unlimited public testers | 4-8 weeks  | Load testing, final polish, documentation         | Low           |
| **GA**          | General public           | N/A        | Production stability                              | Minimal       |

---

## Alpha Testing

### Objectives

1. Validate core eprint submission and indexing workflows
2. Verify ATProto compliance (firehose consumption, PDS interactions, data sovereignty)
3. Test knowledge graph functionality and moderation workflows
4. Identify critical bugs and architectural issues
5. Validate security model and authentication flows

### Entry Criteria

Before entering alpha:

- [ ] All P0 (critical) and P1 (high) bugs from internal testing resolved
- [ ] Core user journeys functional end-to-end
- [ ] ATProto compliance test suite passing at 100%
- [ ] Security audit of authentication and authorization complete
- [ ] Staging environment stable for 72+ hours under load
- [ ] Monitoring and alerting infrastructure operational
- [ ] Rollback procedures documented and tested
- [ ] **Communication channels configured** (see [Communication Channels](#communication-channels))
- [ ] **PDS for @chive.pub operational** (see [PDS Setup](#pds-setup-for-chivepub))
- [ ] **Alpha signup landing page deployed** (see [Alpha Signup Landing Page](#alpha-signup-landing-page))
- [ ] **Bluesky announcement thread drafted and reviewed**

### Alpha Tester Profile

**Target: 20-50 testers**

| Category              | Count | Selection Criteria                                  |
| --------------------- | ----- | --------------------------------------------------- |
| Internal team         | 5-10  | Developers, PMs, designers not on core team         |
| ATProto community     | 5-10  | Bluesky developers, PDS operators, protocol experts |
| Academic partners     | 5-15  | Researchers who've expressed interest, librarians   |
| Technical advisors    | 3-5   | Security researchers, distributed systems experts   |
| Accessibility testers | 2-5   | Users with screen readers, motor impairments        |

### Alpha Test Plan

#### Week 1-2: Foundation Testing

- Account creation and ATProto authentication
- Basic eprint submission flow
- File upload and blob handling (BlobRef validation)
- Search functionality (basic queries)

#### Week 3-4: Core Features

- Version management for eprints
- Review and endorsement workflows
- Tagging and knowledge graph interactions
- Notification system

#### Week 5-6: Integration Testing

- Federation with external PDS instances
- Firehose replay and index rebuilding
- Plugin system (GitHub, ORCID, DOI integrations)
- API completeness (XRPC and REST)

#### Week 7-8: Stress and Edge Cases

- Concurrent submission handling
- Large file uploads
- Malformed data handling
- Recovery from network partitions

### Exit Criteria

- [ ] 95% of test cases passing
- [ ] No P0 bugs open
- [ ] Fewer than 5 P1 bugs open (with mitigations documented)
- [ ] ATProto compliance maintained at 100%
- [ ] Mean Time to Recovery (MTTR) < 30 minutes
- [ ] Alpha tester satisfaction score ≥ 3.5/5

---

## Alpha Signup Landing Page

### Overview

The alpha signup page at `alpha.chive.pub` (or `chive.pub/alpha`) provides a streamlined, ATProto-native signup experience. Users sign up using their existing Bluesky handle or DID—no separate account creation required.

### Design Principles

1. **ATProto-Native**: Leverage existing Bluesky identity for frictionless onboarding
2. **Professional**: Academic tone suitable for researchers
3. **Informative**: Clear explanation of what alpha testing involves
4. **Minimal**: Collect only essential information upfront

### Page Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           HERO SECTION                               │   │
│  │                                                                      │   │
│  │                    [Chive Logo]                                      │   │
│  │                                                                      │   │
│  │           Decentralized Eprint Server                              │   │
│  │           Built on AT Protocol                                       │   │
│  │                                                                      │   │
│  │    Own your research. Share it freely. Keep it forever.             │   │
│  │                                                                      │   │
│  │              [Join Alpha Testing]                                    │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        VALUE PROPOSITION                             │   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │  Your Data  │  │  Credible   │  │  Rich       │  │  Open       │ │   │
│  │  │  Your PDS   │  │  Exit       │  │  Knowledge  │  │  Reviews    │ │   │
│  │  │             │  │             │  │  Graph      │  │             │ │   │
│  │  │ Eprints   │  │ If Chive    │  │ 10-dim     │  │ Transparent │ │   │
│  │  │ live in     │  │ shuts down, │  │ PMEST      │  │ peer review │ │   │
│  │  │ your PDS    │  │ you keep    │  │ faceted    │  │ with ORCID  │ │   │
│  │  │             │  │ everything  │  │ search     │  │ identity    │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        SIGNUP FORM                                   │   │
│  │                                                                      │   │
│  │  Sign Up for Alpha Testing                                          │   │
│  │                                                                      │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │ Bluesky Handle or DID                                         │  │   │
│  │  │ ┌─────────────────────────────────────────────────────────┐   │  │   │
│  │  │ │  @yourhandle.bsky.social                                │   │  │   │
│  │  │ └─────────────────────────────────────────────────────────┘   │  │   │
│  │  │                                                               │  │   │
│  │  │ Email (for alpha communications)                              │  │   │
│  │  │ ┌─────────────────────────────────────────────────────────┐   │  │   │
│  │  │ │  researcher@university.edu                              │   │  │   │
│  │  │ └─────────────────────────────────────────────────────────┘   │  │   │
│  │  │                                                               │  │   │
│  │  │ I am a... (select one)                                        │  │   │
│  │  │ ○ Researcher    ○ Librarian    ○ Developer                   │  │   │
│  │  │ ○ Student       ○ Publisher    ○ Other                       │  │   │
│  │  │                                                               │  │   │
│  │  │ Research field or interest area                               │  │   │
│  │  │ ┌─────────────────────────────────────────────────────────┐   │  │   │
│  │  │ │  Computational Biology                                  │   │  │   │
│  │  │ └─────────────────────────────────────────────────────────┘   │  │   │
│  │  │                                                               │  │   │
│  │  │ Why do you want to test Chive? (brief, optional)             │  │   │
│  │  │ ┌─────────────────────────────────────────────────────────┐   │  │   │
│  │  │ │                                                         │   │  │   │
│  │  │ │                                                         │   │  │   │
│  │  │ └─────────────────────────────────────────────────────────┘   │  │   │
│  │  │                                                               │  │   │
│  │  │ □ I agree to the Alpha Testing Agreement                      │  │   │
│  │  │                                                               │  │   │
│  │  │           [Request Alpha Access]                              │  │   │
│  │  │                                                               │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  Don't have a Bluesky account?                                      │   │
│  │  [Create one at bsky.app →]                                         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        WHAT TO EXPECT                                │   │
│  │                                                                      │   │
│  │  Alpha Testing Involves:                                            │   │
│  │  • Testing core eprint submission and discovery workflows         │   │
│  │  • Reporting bugs through our Zulip community or GitHub             │   │
│  │  • Providing feedback on UX and feature priorities                  │   │
│  │  • 2-5 hours/week engagement for 6-8 weeks                          │   │
│  │                                                                      │   │
│  │  Alpha Testers Receive:                                             │   │
│  │  • Early adopter badge on your Chive profile                        │   │
│  │  • Direct influence on product roadmap                              │   │
│  │  • Acknowledgment in release notes                                  │   │
│  │  • Priority support at GA launch                                    │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           FOOTER                                     │   │
│  │                                                                      │   │
│  │  Follow @chive.pub on Bluesky | GitHub | Documentation              │   │
│  │                                                                      │   │
│  │  Privacy Policy | Terms of Service | Contact                        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Signup Form Specification

```typescript
interface AlphaSignupForm {
  // Required fields
  identity: {
    // Accept either handle or DID
    value: string;
    type: 'handle' | 'did';
    // Validation: resolve via ATProto to confirm valid identity
    validated: boolean;
    resolvedDid?: string;
  };

  email: string; // For alpha communications (not linked to ATProto identity)

  role:
    | 'researcher_faculty'
    | 'researcher_postdoc'
    | 'graduate_student'
    | 'undergraduate_student'
    | 'librarian'
    | 'publisher_editor'
    | 'developer'
    | 'other';

  researchField: string; // Free-form

  // Optional fields
  motivation?: string; // Brief explanation, max 500 chars

  // Agreement
  acceptedTerms: boolean;
  acceptedAt: Date;
}
```

### Identity Validation Flow

```
User enters handle/DID
        ↓
┌───────────────────────────────────────┐
│ Client-side validation                │
│ - Handle format: @*.* or did:plc:*    │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│ Server-side DID resolution            │
│ - For handles: resolve via bsky.social│
│   or custom PDS                       │
│ - For DIDs: verify format             │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│ Display verification                  │
│ "Verified: @user.bsky.social"         │
│ "DID: did:plc:abc123..."              │
└───────────────────────────────────────┘
        ↓
Form submission enabled
```

### Post-Signup Flow

1. **Immediate**: Confirmation page with:
   - "Thank you for applying to Chive alpha!"
   - "We'll review your application and reach out within 5 business days"
   - Link to follow @chive.pub on Bluesky
   - Link to documentation for early reading

2. **Review Process**:
   - Applications reviewed against selection criteria (see [Selection Criteria](#selection-criteria))
   - Cohort balancing applied
   - Approval/waitlist notification via email

3. **Onboarding (Approved)**:
   - Welcome email with access instructions
   - Alpha access enabled on app.chive.pub (DID-based allowlist)
   - Personalized testing assignments based on role/expertise

### Technical Implementation

**Stack**: Next.js page on Server 3, or static site with serverless API

**Database**: Simple PostgreSQL table for applications (can use Supabase or similar)

```sql
CREATE TABLE alpha_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  did TEXT NOT NULL UNIQUE,
  handle TEXT,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  research_field TEXT NOT NULL,
  motivation TEXT,
  accepted_terms_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'waitlisted', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alpha_applications_status ON alpha_applications(status);
CREATE INDEX idx_alpha_applications_did ON alpha_applications(did);
```

---

## Governance PDS

### Purpose

The Governance PDS (`governance-pds` service in docker-compose) stores community-approved authority records:

- Field taxonomy definitions
- Authority records (authors, institutions)
- Approved governance decisions

This makes governance data ATProto-native and portable.

### Configuration

The governance PDS runs as a Docker service in `docker/docker-compose.prod.yml`:

```yaml
governance-pds:
  image: ghcr.io/bluesky-social/pds:latest
  environment:
    - PDS_HOSTNAME=governance.${DOMAIN}
    - PDS_DATA_DIRECTORY=/pds
  volumes:
    - governance-pds-data:/pds
```

### Accessing

The governance PDS is available at `governance.${DOMAIN}` (e.g., `governance.chive.pub`).

---

## Bluesky Advertisement Strategy

### Official Account: @chive.pub

All Bluesky marketing originates from `@chive.pub`, hosted on our own PDS. This demonstrates commitment to decentralization and allows full brand control.

### Content Strategy

#### Content Pillars

1. **Educational**: Explain how Chive works, ATProto benefits, data sovereignty
2. **Community**: Highlight testers, share feedback, celebrate milestones
3. **Transparency**: Development updates, roadmap discussions, bug fixes
4. **Engagement**: Ask questions, respond to mentions, participate in academic discussions

#### Posting Cadence

| Content Type         | Frequency               | Best Times          |
| -------------------- | ----------------------- | ------------------- |
| Educational threads  | 2-3/week                | Tues/Thurs 10am ET  |
| Development updates  | Weekly                  | Friday 2pm ET       |
| Community highlights | 1-2/week                | Variable            |
| Engagement/replies   | Daily                   | Throughout day      |
| Alpha call-to-action | 2-3x during recruitment | Tues/Thurs mornings |

### Launch Thread: Introducing Chive

The following thread introduces Chive to the Bluesky community. Post as a single thread from `@chive.pub`.

---

#### Thread Content

**Post 1/12 (Hook)**

```
Eprints changed science. But they're still controlled by centralized platforms.

What if your eprints lived in YOUR data store, portable and permanent?

Introducing Chive—a decentralized eprint service built on AT Protocol.

🧵 Here's how it works...
```

**Post 2/12 (The Problem)**

```
Traditional eprint services (arXiv, bioRxiv, etc.) are valuable but:

• Your data lives on their servers
• If they shut down, your work could vanish
• You can't take your eprints elsewhere
• No interoperability between platforms

Chive solves this with ATProto.
```

**Post 3/12 (ATProto Foundation)**

```
Chive is an "AppView" on AT Protocol—the same tech powering Bluesky.

Your eprints are stored in YOUR Personal Data Server (PDS), just like your Bluesky posts.

Chive indexes and displays them, but never owns them.

Your research. Your PDS. Your control.
```

**Post 4/12 (Credible Exit)**

```
If Chive disappeared tomorrow, you'd lose nothing.

Your eprints remain in your PDS. Another AppView could display them. You could self-host.

This is "credible exit"—the freedom to leave without losing your data.

No other eprint service offers this.
```

**Post 5/12 (Screenshot - Submission Flow)**

```
Submitting an eprint takes minutes:

1. Upload your PDF
2. Add metadata, authors, license
3. Tag with knowledge graph fields
4. Publish—it goes to YOUR PDS

[SCREENSHOT: Multi-step submission wizard showing the clean UI]
```

**Post 6/12 (Screenshot - Knowledge Graph)**

```
Chive organizes research with a rich knowledge graph:

• 10-dimensional PMEST faceted classification
• Wikipedia-style community curation
• Wikidata integration for authority control
• Browse by field, methodology, phenomenon

[SCREENSHOT: Knowledge graph browse interface with field hierarchy]
```

**Post 7/12 (Screenshot - Search)**

```
Find research with advanced search:

• Full-text search across all eprints
• Filter by field, author, date, license
• Faceted browse for exploration
• Trending eprints by time window

[SCREENSHOT: Search results page with faceted filters]
```

**Post 8/12 (Open Peer Review)**

```
Chive supports transparent peer review:

• Inline comments on eprints
• Threaded discussions
• ORCID-linked author identity
• CRediT-based endorsements

All reviews are public, attributed, and stored in reviewers' PDSes.

[SCREENSHOT: Review thread on an eprint]
```

**Post 9/12 (Integrations)**

```
Chive integrates with tools researchers already use:

• ORCID for identity
• GitHub/GitLab for code
• Zenodo for DOI archival
• Figshare, Dryad, OSF for datasets

All linked from your eprint page.

[SCREENSHOT: Integration panel showing linked resources]
```

**Post 10/12 (Open Source)**

```
Chive is fully open source (MIT license).

• Audit the code
• Self-host if you want
• Contribute features
• Fork if needed

GitHub: github.com/chive-pub/chive

Decentralization means you don't have to trust us—you can verify.
```

**Post 11/12 (Alpha Call)**

```
We're looking for alpha testers.

Who we need:
• Researchers (any field)
• Librarians
• ATProto developers
• Accessibility testers

What you get:
• Shape the future of scholarly publishing
• Early adopter badge
• Direct roadmap influence

Sign up: alpha.chive.pub
```

**Post 12/12 (Closing)**

```
The academic publishing system is broken. Paywalls, vendor lock-in, platform risk.

Chive is building something different—research infrastructure that researchers actually own.

Join us.

alpha.chive.pub
@chive.pub

#OpenScience #Eprints #ATProto #Decentralization
```

---

### Screenshot Specifications

Each screenshot should be:

- **Dimensions**: 1200x675px (16:9, optimal for Bluesky)
- **Format**: PNG with transparency or clean background
- **Content**: Real UI with realistic (but fake) data
- **Accessibility**: Alt text provided for each image

#### Required Screenshots

| Screenshot             | Content                            | Notes                                    |
| ---------------------- | ---------------------------------- | ---------------------------------------- |
| Submission Wizard      | Step 2 (Metadata) with sample data | Show title, abstract, license selector   |
| Knowledge Graph Browse | Field hierarchy expanded           | Show PMEST facets, field relationships   |
| Search Results         | Results for sample query           | Show filters, result cards, highlighting |
| Review Thread          | Comment thread on eprint           | Show threaded replies, author badges     |
| Integration Panel      | Eprint with linked GitHub, ORCID   | Show badges and linked resources         |
| Dashboard              | User dashboard with stats          | Show personalized experience             |
| Eprint Detail          | Full eprint page                   | Hero section with metadata               |

#### Screenshot Generation Process

1. **Seed test data**: Run `npm run seed:screenshots` with curated sample content
2. **Capture**: Use Playwright to capture consistent screenshots
3. **Post-process**: Optimize file size, add subtle branding if needed
4. **Alt text**: Write descriptive alt text for accessibility

```typescript
// Example Playwright screenshot script
const screenshots = [
  {
    name: 'submission-wizard',
    url: '/submit?step=metadata',
    selector: '.submission-wizard',
    altText:
      'Chive submission wizard showing metadata entry with title, abstract, and license selection fields',
  },
  {
    name: 'knowledge-graph-browse',
    url: '/browse',
    selector: '.browse-container',
    altText:
      'Knowledge graph browse interface showing hierarchical field classification with PMEST facets',
  },
  // ... etc
];
```

### Follow-Up Content Calendar

#### Week 1 (Launch Week)

| Day | Content                                                       |
| --- | ------------------------------------------------------------- |
| Mon | Launch thread (12 posts)                                      |
| Tue | Quote-tweet Post 5 (submission) with additional context       |
| Wed | Quote-tweet Post 6 (knowledge graph) with researcher use case |
| Thu | Respond to community questions, repost engaged replies        |
| Fri | Development update: "Here's what we're working on this week"  |

#### Week 2-4 (Recruitment Phase)

| Content Type       | Frequency      |
| ------------------ | -------------- |
| Alpha reminder     | Every 3-4 days |
| Feature highlight  | 2x/week        |
| Community Q&A      | Weekly         |
| Development update | Weekly         |

### Engagement Guidelines

1. **Respond promptly**: Reply to mentions within 4 hours during business hours
2. **Be helpful**: Answer questions thoroughly, link to documentation
3. **Stay professional**: Academic tone, avoid hype language
4. **Amplify testers**: Repost feedback, highlight contributions
5. **Cross-post strategically**: Major announcements also go to Twitter/X, Mastodon

### Hashtag Strategy

**Primary hashtags** (use consistently):

- `#OpenScience`
- `#Eprints`
- `#ATProto`

**Secondary hashtags** (use contextually):

- `#AcademicTwitter` / `#AcademicBluesky`
- `#ScholarlyComms`
- `#Decentralization`
- `#OpenAccess`
- Field-specific tags as relevant

### Community Targeting

#### High-Value Accounts to Engage

| Category               | Examples                          |
| ---------------------- | --------------------------------- |
| Open science advocates | ASAPbio, SPARC, FORCE11           |
| Eprint advocates       | PREreview, preLights              |
| ATProto developers     | Bluesky team, PDS operators       |
| Academic influencers   | Researchers with large followings |
| Research librarians    | Digital scholarship librarians    |

#### Communities to Participate In

- Bluesky #OpenScience community
- Academic Bluesky lists
- ATProto developer discussions
- Open access advocacy spaces

---

## Beta Testing

### Closed Beta

#### Objectives

1. Validate product-market fit with broader academic audience
2. Test at scale (10-100x alpha traffic)
3. Refine UX based on diverse user feedback
4. Validate federation behavior across multiple PDS providers
5. Test moderation and governance workflows

#### Entry Criteria

- [ ] Alpha exit criteria met
- [ ] Onboarding documentation complete
- [ ] Support ticketing system operational
- [ ] Rate limiting and abuse prevention active
- [ ] GDPR/privacy compliance validated

#### Closed Beta Tester Profile

**Target: 200-500 testers**

| Category                                 | Count  | Selection Criteria                            |
| ---------------------------------------- | ------ | --------------------------------------------- |
| Researchers (STEM)                       | 50-100 | Active eprint authors, varied career stages   |
| Researchers (Humanities/Social Sciences) | 30-60  | Underrepresented in eprint culture            |
| Graduate students                        | 40-80  | High engagement potential, diverse needs      |
| Librarians                               | 20-40  | Institutional perspective, metadata expertise |
| Journal editors                          | 10-20  | Publishing workflow integration               |
| Eprint advocates                         | 10-20  | ASAPbio, PREreview community members          |
| Accessibility testers                    | 10-20  | Expanded from alpha cohort                    |
| International users                      | 30-60  | Non-English speakers, varied connectivity     |
| ATProto enthusiasts                      | 20-40  | Decentralization advocates, technical users   |

#### Closed Beta Test Plan

**Phase 1 (Weeks 1-4): Onboarding Wave**

- Staggered invitations (50 users/week)
- Focus on onboarding friction and documentation gaps
- Collect first-impression feedback within 48 hours

**Phase 2 (Weeks 5-8): Feature Depth**

- Full feature access for all testers
- Structured testing assignments by user persona
- A/B testing of UX variations
- Stress testing with coordinated submission events

**Phase 3 (Weeks 9-12): Polish and Scale**

- Load testing at projected GA levels
- Final UX refinements
- Documentation freeze and review
- Migration testing from other eprint services

### Open Beta

#### Objectives

1. Validate infrastructure at production scale
2. Crowdsource edge case discovery
3. Build community and early adopter base
4. Generate launch content (testimonials, case studies)

#### Entry Criteria

- [ ] Closed beta exit criteria met
- [ ] Public documentation complete
- [ ] Self-service support resources operational
- [ ] Marketing and launch plan finalized

#### Open Beta Considerations

- **No NDA required**: Public discussions allowed
- **Feature-complete**: No major feature additions during open beta
- **Data persistence**: Clearly communicate data retention policy
- **Support SLA**: Define expected response times for community support

---

## Tester Recruitment

### Recruitment Channels

#### Primary Channel: Bluesky

Given Chive's ATProto foundation, Bluesky is the primary recruitment channel.

| Approach                        | Expected Yield    |
| ------------------------------- | ----------------- |
| Launch announcement thread      | 50-100 applicants |
| Ongoing recruitment posts       | 30-50 applicants  |
| Community engagement            | 20-40 applicants  |
| Repost campaigns from advocates | 30-50 applicants  |

#### Academic Networks

| Channel                         | Approach                            | Expected Yield     |
| ------------------------------- | ----------------------------------- | ------------------ |
| Eprint servers (arXiv, bioRxiv) | Author outreach via Bluesky         | 50-100 applicants  |
| Academic Bluesky/Twitter        | Announcement posts, RT campaigns    | 100-200 applicants |
| Research librarian associations | ALA, ACRL mailing lists             | 30-50 applicants   |
| Open science communities        | ASAPbio, FORCE11, OpenCon           | 50-100 applicants  |
| University partnerships         | Direct outreach to research offices | 20-40 applicants   |

#### Technical Networks

| Channel                    | Approach                         | Expected Yield    |
| -------------------------- | -------------------------------- | ----------------- |
| ATProto community          | Bluesky, GitHub discussions      | 50-100 applicants |
| Decentralization advocates | Mastodon, Matrix communities     | 30-50 applicants  |
| Developer communities      | Hacker News, Reddit r/selfhosted | 40-80 applicants  |

### Application Process

Alpha applications are collected via the landing page at `alpha.chive.pub`. The simplified form prioritizes ATProto identity.

#### Core Application Fields

```yaml
# Required fields
- name: Bluesky Handle or DID
  type: text
  description: 'Your @handle.bsky.social or did:plc:...'
  required: true
  validation: ATProto identity resolution

- name: Email
  type: email
  required: true

- name: Role
  type: select
  options:
    - Researcher (Faculty)
    - Researcher (Postdoc)
    - Graduate Student
    - Undergraduate Student
    - Librarian
    - Publisher/Editor
    - Developer/Technical
    - Science Communicator
    - Other
  required: true

- name: Research Field
  type: text
  description: 'Primary discipline (e.g., Physics, Biology, Economics)'
  required: true

# Optional fields
- name: Motivation
  type: textarea
  description: 'Why do you want to test Chive? (optional, max 500 chars)'
  required: false

- name: ATProto Experience
  type: select
  options:
    - Just have a Bluesky account
    - Active Bluesky user
    - Run my own PDS
    - ATProto developer
  required: false
```

### Selection Criteria

#### Scoring Matrix (0-5 each)

| Criterion                  | Weight | Description                                          |
| -------------------------- | ------ | ---------------------------------------------------- |
| Diversity                  | 25%    | Underrepresented field, geography, career stage      |
| Engagement likelihood      | 25%    | Motivation quality, availability, eprint experience  |
| Technical diversity        | 20%    | OS, browser, network conditions, ATProto familiarity |
| Feedback quality potential | 20%    | Communication skills, domain expertise               |
| Strategic value            | 10%    | Influencer potential, institutional partnership      |

#### Cohort Balancing

Ensure each testing cohort includes:

- At least 30% non-STEM researchers
- At least 20% from Global South institutions
- At least 15% graduate students
- At least 10% with accessibility needs
- At least 10% with ATProto experience
- Gender balance reflecting applicant pool

### Incentives

#### Non-Monetary

- Early adopter badge on profile
- Acknowledgment in release notes
- Priority support during GA
- Beta tester community access (permanent)
- Influence on product roadmap
- Co-authorship opportunity on launch publication

#### Monetary (if budget permits)

- Gift cards ($25-50) for completing structured feedback sessions
- Stipends for accessibility testers requiring specialized setup
- Travel grants for in-person user research sessions

---

## Feedback Infrastructure

### Feedback Collection Tools

#### 1. In-App Feedback Widget

**Tool: Canny or UserVoice (self-hosted alternative: Fider)**

Features:

- Persistent feedback button in UI
- Screenshot capture
- Session metadata auto-attachment
- Upvoting and commenting on existing feedback
- Status tracking (Under Review → Planned → In Progress → Complete)

Configuration:

```typescript
interface FeedbackWidgetConfig {
  position: 'bottom-right';
  categories: [
    'Bug Report',
    'Feature Request',
    'UX Improvement',
    'Documentation',
    'Performance',
    'Accessibility',
  ];
  autoAttach: {
    sessionId: true;
    browserInfo: true;
    currentUrl: true;
    consoleErrors: true;
    screenshot: 'optional';
  };
}
```

#### 2. Session Replay

**Tool: PostHog (self-hosted) or LogRocket**

Captures:

- Full session recordings (with PII masking)
- Click heatmaps
- Rage click detection
- Error correlation with user actions
- Funnel analysis

Privacy configuration:

```typescript
interface SessionReplayConfig {
  maskAllInputs: true;
  maskAllText: false; // Research content is expected
  blockSelector: '[data-private]'; // Mask sensitive UI elements
  recordConsoleErrors: true;
  recordNetworkErrors: true;
  sampleRate: 0.5; // 50% of sessions during beta
}
```

#### 3. Error Tracking

**Tool: Sentry**

Configuration:

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'beta',
  release: process.env.RELEASE_VERSION,
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: ['api.chive.pub'],
    }),
    new Sentry.Replay({
      maskAllText: false,
      maskAllInputs: true,
    }),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event) {
    // Strip PII from error reports
    return sanitizeEvent(event);
  },
});
```

#### 4. Surveys

**Tool: Typeform or self-hosted LimeSurvey**

Survey schedule:
| Survey | Timing | Duration | Purpose |
|--------|--------|----------|---------|
| Onboarding | 48h after signup | 5 min | First impressions, friction points |
| Weekly pulse | Every Monday | 2 min | NPS, blockers, highlights |
| Feature-specific | After major feature use | 3 min | Feature satisfaction, usability |
| Exit | On churn signal or request | 10 min | Reasons for leaving, improvements |
| Milestone | End of each phase | 15 min | Comprehensive feedback |

#### 5. User Interviews

**Tool: Calendly + Zoom/Google Meet**

Schedule:

- Alpha: 10-15 interviews total (30% of testers)
- Closed Beta: 30-50 interviews (10-15% of testers)
- Open Beta: 20-30 interviews (targeted based on feedback)

Interview protocol:

1. Warm-up (2 min): Current eprint workflow
2. Task observation (15 min): Complete assigned tasks while thinking aloud
3. Pain points (5 min): What frustrated you?
4. Feature feedback (5 min): What's missing? What surprised you?
5. Wrap-up (3 min): Overall impressions, likelihood to recommend

---

## Bug Reporting System

### Bug Tracking Platform

**Primary: GitHub Issues** (public visibility, developer familiarity)
**Alternative: Linear** (better triage UX, private until ready)

### Bug Report Template

```markdown
---
name: Bug Report
about: Report a bug to help us improve Chive
title: '[BUG] '
labels: 'bug, needs-triage'
assignees: ''
---

## Bug Description

<!-- A clear, concise description of the bug -->

## Steps to Reproduce

1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

## Expected Behavior

<!-- What you expected to happen -->

## Actual Behavior

<!-- What actually happened -->

## Environment

<!-- Auto-populated by feedback widget where possible -->

| Field         | Value                                   |
| ------------- | --------------------------------------- |
| Browser       | <!-- e.g., Chrome 120.0.6099.109 -->    |
| OS            | <!-- e.g., macOS 14.2 -->               |
| Device        | <!-- e.g., MacBook Pro M2 -->           |
| Screen Size   | <!-- e.g., 1920x1080 -->                |
| Network       | <!-- e.g., WiFi, 50 Mbps -->            |
| Chive Version | <!-- e.g., 0.2.0-beta.3 -->             |
| PDS Provider  | <!-- e.g., bsky.social, self-hosted --> |

## Session Information

<!-- If available from feedback widget -->

- Session ID: `<!-- auto-populated -->`
- Session Replay URL: `<!-- auto-populated -->`
- Error ID (Sentry): `<!-- auto-populated -->`

## Console Output

<!-- Any relevant console errors -->
```

<!-- Paste console output here -->

```

## Network Requests
<!-- Failing API calls, if relevant -->

| Request | Status | Response |
|---------|--------|----------|

## Screenshots/Recordings
<!-- Attach screenshots or screen recordings -->

## Additional Context
<!-- Any other relevant information -->

## Impact Assessment
<!-- How severely does this affect your workflow? -->

- [ ] Blocker: Cannot use Chive at all
- [ ] Critical: Major feature completely broken
- [ ] Major: Feature partially broken, workaround exists
- [ ] Minor: Cosmetic or minor inconvenience
- [ ] Trivial: Suggestion or edge case
```

### Automated Metadata Collection

Implement client-side collection to auto-populate bug reports:

```typescript
interface BugReportMetadata {
  // Environment
  browser: {
    name: string;
    version: string;
    engine: string;
  };
  os: {
    name: string;
    version: string;
  };
  device: {
    type: 'desktop' | 'tablet' | 'mobile';
    model?: string;
    screenSize: { width: number; height: number };
    pixelRatio: number;
  };

  // Session
  sessionId: string;
  userId?: string; // Hashed DID
  sessionDuration: number;
  pageUrl: string;
  referrer?: string;

  // Application
  appVersion: string;
  featureFlags: Record<string, boolean>;
  locale: string;
  timezone: string;

  // ATProto
  pdsProvider?: string;
  authenticatedDid?: string;

  // Performance
  connectionType?: string;
  effectiveBandwidth?: number;
  rtt?: number;

  // Errors
  consoleErrors: Array<{
    message: string;
    stack?: string;
    timestamp: number;
  }>;

  // User Journey
  recentActions: Array<{
    action: string;
    timestamp: number;
    target?: string;
  }>;

  // Attachments
  screenshot?: Blob;
  sessionReplayUrl?: string;
  sentryEventId?: string;
}
```

### Bug Triage Process

#### Severity Definitions

| Severity      | Definition                                         | Response SLA | Resolution SLA |
| ------------- | -------------------------------------------------- | ------------ | -------------- |
| P0 - Critical | Data loss, security vulnerability, complete outage | 1 hour       | 24 hours       |
| P1 - High     | Major feature broken, no workaround                | 4 hours      | 72 hours       |
| P2 - Medium   | Feature broken, workaround available               | 24 hours     | 1 week         |
| P3 - Low      | Minor bug, cosmetic issues                         | 48 hours     | 2 weeks        |
| P4 - Trivial  | Enhancement, edge case                             | 1 week       | Backlog        |

#### Triage Workflow

```
New Bug → Auto-label by category → Triage Queue
                                        ↓
                              Triage Meeting (daily during beta)
                                        ↓
                    ┌───────────────────┼───────────────────┐
                    ↓                   ↓                   ↓
               Duplicate?          Needs Info?         Confirmed
                    ↓                   ↓                   ↓
              Link & Close      Request Details      Assign Priority
                                        ↓                   ↓
                              Wait for Response     Assign to Sprint
                                        ↓                   ↓
                              Auto-close (14 days)     Development
                                                            ↓
                                                    Code Review
                                                            ↓
                                                    QA Verification
                                                            ↓
                                                    Deploy to Beta
                                                            ↓
                                                    Notify Reporter
```

#### Bug Labels

```yaml
# Severity
- p0-critical
- p1-high
- p2-medium
- p3-low
- p4-trivial

# Status
- needs-triage
- needs-info
- confirmed
- in-progress
- in-review
- ready-for-qa
- resolved
- wont-fix
- duplicate

# Category
- bug/ui
- bug/api
- bug/auth
- bug/search
- bug/knowledge-graph
- bug/performance
- bug/accessibility
- bug/atproto-compliance
- bug/federation
- bug/mobile

# Source
- source/alpha
- source/closed-beta
- source/open-beta
- source/internal

# Platform
- platform/web
- platform/ios
- platform/android
- platform/api
```

---

## Communication Channels

> **Note**: Community chat infrastructure is not yet deployed. The following describes planned communication channels.

### Planned Channels

- **GitHub Issues**: Bug reports and feature requests
- **Bluesky**: Official announcements via @chive.pub
- **Email**: Direct tester communications

### Communication Cadence

| Communication   | Frequency      | Channel        | Audience    |
| --------------- | -------------- | -------------- | ----------- |
| Release notes   | Per deployment | Email, Bluesky | All testers |
| Weekly digest   | Weekly         | Email          | All testers |
| Bug updates     | Real-time      | GitHub         | Reporters   |
| Roadmap review  | Monthly        | Video call     | All testers |
| Bluesky updates | 2-3x/week      | @chive.pub     | Public      |

### Email Templates

#### Welcome Email (Alpha)

```
Subject: Welcome to Chive Alpha Testing

Hi [Name],

Thank you for joining the Chive alpha testing program! You're among the first
[X] people to help shape the future of decentralized scholarly publishing.

**Getting Started**
1. Log in to Chive with your Bluesky account: https://chive.pub
2. Review the testing guide: [link]

**This Week's Focus**
[Current testing priorities]

**How to Report Bugs**
- GitHub Issues: [link to issues]
- Email: alpha@chive.pub

**Your Testing Assignment**
Based on your profile as a [Role], we'd especially love your feedback on:
- [Personalized area based on expertise]

**Connect with Us**
- Bluesky: @chive.pub
- Email: alpha@chive.pub

Questions? Reply to this email.

Thank you for helping build Chive!

The Chive Team
```

#### Weekly Digest Template

```
Subject: Chive Alpha Weekly Digest - Week [N]

**What's New This Week**
- [Feature/fix 1]
- [Feature/fix 2]
- [Feature/fix 3]

**By the Numbers**
- Bugs reported: [X]
- Bugs fixed: [Y]
- Feature requests: [Z]

**Top Bugs to Watch**
1. [Bug title] - Status: [status]
2. [Bug title] - Status: [status]

**This Week's Focus**
We're particularly interested in feedback on [area]. If you have 15 minutes,
please try [specific workflow] and let us know how it goes.

**Community Highlights**
- [Interesting discussion/finding from Zulip]
- [Helpful bug report or suggestion]

**Upcoming**
- [Planned feature or event]

[Survey link if applicable]

Thank you for your continued testing!

---
Follow us: @chive.pub on Bluesky
Community: community.chive.pub
```

---

## Metrics and Success Criteria

### Key Performance Indicators

#### Engagement Metrics

| Metric                | Alpha Target  | Closed Beta Target | Open Beta Target |
| --------------------- | ------------- | ------------------ | ---------------- |
| Weekly Active Testers | 70%           | 50%                | 30%              |
| Avg. Session Duration | 10+ min       | 15+ min            | 20+ min          |
| Feedback Submissions  | 2/tester/week | 1/tester/week      | 0.5/tester/week  |
| Bug Reports           | 50 total      | 200 total          | 500 total        |
| Survey Response Rate  | 80%           | 60%                | 40%              |

#### Quality Metrics

| Metric                 | Alpha Exit | Beta Exit | GA Ready |
| ---------------------- | ---------- | --------- | -------- |
| P0 Bugs Open           | 0          | 0         | 0        |
| P1 Bugs Open           | < 5        | 0         | 0        |
| P2 Bugs Open           | < 20       | < 10      | < 5      |
| Test Coverage          | 80%        | 85%       | 90%      |
| ATProto Compliance     | 100%       | 100%      | 100%     |
| WCAG 2.1 AA Compliance | 90%        | 95%       | 100%     |

#### Satisfaction Metrics

| Metric            | Alpha Target | Beta Target | GA Target |
| ----------------- | ------------ | ----------- | --------- |
| NPS               | > 20         | > 40        | > 50      |
| CSAT              | > 3.5/5      | > 4.0/5     | > 4.2/5   |
| Task Success Rate | > 70%        | > 85%       | > 95%     |
| Would Recommend   | > 60%        | > 75%       | > 85%     |

#### Technical Metrics

| Metric            | Target  |
| ----------------- | ------- |
| API Latency (p95) | < 500ms |
| Page Load (LCP)   | < 2.5s  |
| Error Rate        | < 0.1%  |
| Uptime            | > 99.5% |
| Firehose Lag      | < 30s   |

#### Bluesky Engagement Metrics

| Metric                 | Launch Week | Ongoing  |
| ---------------------- | ----------- | -------- |
| Thread impressions     | 10,000+     | N/A      |
| Thread engagements     | 500+        | N/A      |
| New followers          | 200+        | 50+/week |
| Alpha applications     | 100+        | N/A      |
| Reposts from advocates | 10+         | 5+/week  |

### Dashboards

Create dashboards for:

1. **Tester Engagement**: Active users, session metrics, feature usage
2. **Bug Health**: Open bugs by severity, resolution time, regression rate
3. **Feedback Pipeline**: Submissions, triage status, response time
4. **System Health**: Performance, errors, uptime
5. **Satisfaction**: NPS trend, CSAT by feature, sentiment analysis
6. **Bluesky Analytics**: Follower growth, engagement rates, application conversions

---

## Timeline and Milestones

### Phase Gates

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TESTING TIMELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INTERNAL QA          ALPHA           CLOSED BETA      OPEN BETA    GA     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                  │              │                 │              │          │
│               Alpha          Alpha            Beta           Beta       GA  │
│               Entry          Exit             Entry          Exit     Ready │
│                                                                             │
│  Checkpoints:    ◆              ◆                ◆              ◆       ◆   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pre-Alpha Infrastructure Milestones

- [ ] Server 1 (Application) provisioned and configured
- [ ] Server 2 (Zulip) provisioned and configured
- [ ] Server 3 (PDS/Landing) provisioned and configured
- [ ] DNS configured for all subdomains
- [ ] PDS for @chive.pub operational
- [ ] Alpha signup landing page deployed
- [ ] Zulip server operational with stream structure
- [ ] Bluesky launch thread drafted and reviewed
- [ ] Screenshots captured for marketing materials

### Milestone Definitions

#### Alpha Entry Milestone

- [ ] Internal QA sign-off
- [ ] Staging environment stable
- [ ] Test infrastructure operational
- [ ] Alpha testers recruited and onboarded
- [ ] Zulip server configured
- [ ] Bug tracking ready
- [ ] @chive.pub Bluesky account active
- [ ] Launch thread posted

#### Alpha Exit Milestone

- [ ] Alpha exit criteria met (see above)
- [ ] Retrospective completed
- [ ] Closed beta recruitment complete
- [ ] Documentation updated based on feedback
- [ ] Known issues documented

#### Beta Entry Milestone

- [ ] Alpha issues resolved
- [ ] Onboarding flow validated
- [ ] Support processes tested
- [ ] Scale testing passed
- [ ] Beta testers onboarded

#### Beta Exit Milestone

- [ ] Beta exit criteria met
- [ ] All P0/P1 bugs resolved
- [ ] Performance targets met
- [ ] Accessibility audit passed
- [ ] Security audit passed
- [ ] Documentation complete
- [ ] Launch plan approved

#### GA Readiness

- [ ] Final QA sign-off
- [ ] Operations runbook complete
- [ ] Support team trained
- [ ] Marketing materials ready
- [ ] Legal review complete

---

## Legal and Compliance

### Tester Agreements

#### Non-Disclosure Agreement (Alpha Only)

Alpha testers must sign NDA covering:

- Unreleased features and roadmap
- Security vulnerabilities discovered
- Internal discussions and communications
- Performance and usage data

Duration: Until GA launch or public disclosure

#### Beta Testing Agreement (All Testers)

All testers agree to:

- Terms of service
- Privacy policy
- Acceptable use policy
- Bug reporting responsibilities
- Data handling expectations

### Data Privacy

#### Tester Data Collection

| Data Type             | Purpose                    | Retention                 | Legal Basis         |
| --------------------- | -------------------------- | ------------------------- | ------------------- |
| DID/Handle            | Identity, access control   | Until offboarding         | Consent             |
| Email                 | Communication              | Until offboarding         | Consent             |
| Application responses | Selection, personalization | 1 year post-GA            | Consent             |
| Session data          | Bug investigation          | 90 days                   | Legitimate interest |
| Feedback              | Product improvement        | Indefinitely (anonymized) | Consent             |
| Bug reports           | Issue resolution           | Indefinitely              | Legitimate interest |

#### GDPR Compliance

- Right to access: Testers can request their data
- Right to deletion: Testers can request removal (except anonymized feedback)
- Data portability: Export available in standard formats
- Privacy by design: Minimal data collection, purpose limitation

### Intellectual Property

- Bug reports and feedback become Chive property
- Testers retain rights to any scholarly content submitted
- Testers grant license to use testimonials (with approval)

### Liability

- Beta software provided "as-is"
- No guarantee of data persistence until GA
- Testers advised not to use for critical scholarly work until GA
- Clear data backup recommendations provided

---

## Appendices

### Appendix A: Bug Report Quality Checklist

High-quality bug reports include:

- [ ] Clear, descriptive title
- [ ] Steps to reproduce (numbered)
- [ ] Expected vs. actual behavior
- [ ] Environment details (auto-collected where possible)
- [ ] Screenshot or recording
- [ ] Console errors (if applicable)
- [ ] Severity assessment
- [ ] Reproducibility (always/sometimes/rarely)

### Appendix B: Feature Request Template

```markdown
## Feature Request

### Problem Statement

<!-- What problem does this solve? Who has this problem? -->

### Proposed Solution

<!-- How would you solve this? -->

### Alternatives Considered

<!-- What other approaches did you consider? -->

### Use Cases

<!-- Specific scenarios where this would help -->

### Priority Assessment

- How many users affected: [Few / Some / Many / All]
- Frequency of need: [Rarely / Sometimes / Often / Always]
- Workaround exists: [Yes / No]
- Blocking other work: [Yes / No]
```

### Appendix C: Tester Offboarding

When testers leave the program:

1. Exit survey (optional but encouraged)
2. Remove from Zulip channels
3. Revoke beta access (if applicable)
4. Data retention per privacy policy
5. Thank you email with GA launch notification opt-in

### Appendix D: Escalation Paths

| Issue Type     | First Contact      | Escalation        | Final Escalation |
| -------------- | ------------------ | ----------------- | ---------------- |
| Bug            | GitHub Issues      | On-call engineer  | Engineering lead |
| UX feedback    | GitHub/Email       | Product manager   | Product lead     |
| Account issues | support@chive.pub  | Community manager | Operations lead  |
| Security       | security@chive.pub | Security team     | CTO              |
| Harassment/CoC | conduct@chive.pub  | Community manager | Executive team   |

### Appendix E: Screenshot Capture Checklist

Before launch, capture the following screenshots:

| Screenshot        | Page/Route              | Content                  | Status |
| ----------------- | ----------------------- | ------------------------ | ------ |
| Submission Wizard | `/submit?step=metadata` | Filled metadata form     | [ ]    |
| Knowledge Graph   | `/browse`               | Expanded field hierarchy | [ ]    |
| Search Results    | `/search?q=...`         | Results with filters     | [ ]    |
| Review Thread     | `/eprint/[id]#reviews`  | Threaded comments        | [ ]    |
| Integration Panel | `/eprint/[id]`          | GitHub, ORCID badges     | [ ]    |
| Dashboard         | `/dashboard`            | User stats, actions      | [ ]    |
| Eprint Detail     | `/eprint/[id]`          | Full eprint page         | [ ]    |

### Appendix F: Bluesky Thread Posting Checklist

Before posting the launch thread:

- [ ] All screenshots captured and optimized
- [ ] Alt text written for all images
- [ ] Thread content reviewed by team
- [ ] Landing page deployed and tested
- [ ] @chive.pub profile complete (bio, avatar, banner)
- [ ] Zulip ready for incoming testers
- [ ] Application review process documented
- [ ] Team available to respond to engagement

---

## Document History

| Version | Date       | Author   | Changes                                                                      |
| ------- | ---------- | -------- | ---------------------------------------------------------------------------- |
| 1.0     | [Date]     | [Author] | Initial document                                                             |
| 2.0     | 2026-01-02 | [Author] | Added infrastructure architecture, landing page, PDS setup, Bluesky strategy |

---

## Related Documents

- [Testing Strategy](../13-testing/README.md)
- [ATProto Compliance](../../design/00-atproto-compliance.md)
- [Security Architecture](../../design/07-security/zero-trust-architecture.md)
- [Operations Runbook](./OPERATIONS_RUNBOOK.md)

---

## External References

- [Zulip Self-Hosting Requirements](https://zulip.readthedocs.io/en/stable/production/requirements.html)
- [AT Protocol Self-Hosting Guide](https://atproto.com/guides/self-hosting)
- [Bluesky PDS Repository](https://github.com/bluesky-social/pds)
