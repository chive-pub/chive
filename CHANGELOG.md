# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-03-10

### Added

#### Authors Page and Mute Feature

- Personalized authors page showing authors the user follows or has interacted with
- Mute author feature allowing users to hide papers from specific authors in feeds and discovery
- `pub.chive.actor.mute` lexicon record type for storing mute preferences in user PDSes

#### Discovery

- Configurable discovery weight settings allowing users to tune recommendation signal strengths (field affinity, citation overlap, recency, collaborative filtering)
- XRPC array parameter parsing for multi-value query parameters

#### Deployment

- GHCR image registry for CI-built Docker images, eliminating on-server builds during staging deploys
- Staging docs container added to CI/CD pipeline

### Changed

#### Types

- Consolidated rich text `$type` references to use `pub.chive.richtext.defs` namespace across all tests, lexicons, and frontend code
- Replaced `EprintsByAuthorResponse` with `ListByAuthorResponse` from generated types in `use-eprint.ts`
- Replaced `EprintChangelogsResponse` with `ListChangelogsOutput` from generated types in `use-eprint-mutations.ts`
- Replaced manual `Backlink`, `BacklinkCounts`, and `ListBacklinksResponse` with generated types in `use-backlinks.ts`
- Added backlink and changelog type re-exports to `schema.ts` from generated lexicon types
- Replaced `EdgesResponse` in `use-edges.ts` with generated `OutputSchema` from `pub.chive.graph.listEdges`
- Replaced `AuthorEprintsResponse` in `use-author.ts` with `ListByAuthorResponse` from generated types
- Derived `ProposalStatus` and `ProposalType` from generated `ProposalView` instead of manual string unions
- Derived `VoteAction` from generated `VoteView['vote']` instead of manual string union
- Derived `AlphaSector` and `AlphaCareerStage` from generated `alpha/apply` `InputSchema` instead of manual string unions

#### Frontend

- Comprehensive mobile responsiveness overhaul across the entire frontend
- Dashboard, admin, and governance sidebars collapse into Sheet drawers on mobile instead of stacking above content
- Mobile hamburger menu now includes dashboard navigation items for authenticated users
- Mobile search access via dedicated search icon button that opens a top Sheet
- Admin tables wrapped in horizontal scroll containers to prevent page overflow on narrow screens
- Grid layouts use progressive responsive breakpoints (`sm:grid-cols-2 md:grid-cols-3`) instead of jumping directly to multi-column
- Tab lists hide scrollbars for cleaner horizontal scrolling on mobile
- Popover widths constrained to viewport with `max-w-[calc(100vw-2rem)]`
- PDF viewer minimum height reduced on mobile (`min-h-[400px] md:min-h-[600px]`)
- New `useIsMobile` hook and shadcn Sheet component for consistent mobile patterns

#### Types

- Replace redundant annotation hook types (`AnnotationView`, `EntityLinkView`, `ListAnnotationsResponse`, `AnnotationThread`) with generated lexicon types from `pub.chive.annotation`
- Replace `ListUserEndorsementsResponse` with generated `OutputSchema` from `pub.chive.endorsement.listForUser`
- Derive `AnnotationMotivation` from generated `AnnotationView['motivation']` instead of manual string union
- Derive `ContributionType` from generated `EndorsementView['contributions'][number]` instead of manual string union

#### Discovery

- Related papers scoring: lowered combined score threshold from 0.2 to 0.05, reduced ES MLT discount from 0.6 to 0.85, and added author overlap to default signals
- Removed For You feed in favor of configurable discovery weights

#### API Validation

- Enabled server-side XRPC output validation (`validateOutput: true`) to catch schema mismatches at the source before responses reach clients

### Fixed

#### API

- `getHierarchy` handler missing default `relationSlug` value, causing 500 when output validation is enabled
- Authors page only showing search box instead of author grid due to incorrect conditional rendering

#### Tests

- Eprint integration tests failing due to stale PostgreSQL data from prior runs; added `beforeEach` cleanup

#### Admin Dashboard

- Field name mismatches between admin API responses and frontend expectations
- Role name references corrected from `moderator` to `admin` across admin endpoints
- Silent auth failures in admin routes now surface proper error messages

#### Authentication

- Paper PDS auth wired through all edit and delete flows, fixing unauthorized errors when modifying papers
- Unified auth error messages across all endpoints for consistent error handling

#### Frontend

- Removed broken "View all related papers" link pointing to nonexistent page
- Flaky mention-popover arrow key navigation test stabilized by replacing `fireEvent.keyDown` with `userEvent.keyboard`

#### Deployment

- Staging deploy workflow now builds web frontend image in CI and pins both API and web images to the exact commit SHA, preventing frontend-backend version skew
- Split Docker build and push steps to fix GHCR authentication failure
- Test expectations updated to match unified auth error messages
- Discovery test expectations updated for new default weights and weight normalization

## [0.2.0] - 2026-03-06

### Added

#### Admin Dashboard

- Admin dashboard with 15 pages: overview, health, alpha access, users, content, firehose, backfill, PDS, graph, metrics, search analytics, activity, endpoints, runtime, and governance
- AdminService for aggregating system health, content statistics, and user management operations
- BackfillManager for triggering and monitoring PDS record backfills from the admin UI
- XRPC handlers for all admin dashboard endpoints across health, content, users, firehose, PDS, graph, metrics, search, activity, and governance
- Frontend admin auth guard component that restricts dashboard access to users with admin roles
- Role-based access hooks (`useMyRoles`, `useIsAdmin`) and admin dashboard query hooks
- Admin role seeding from `ADMIN_DIDS` environment variable on server startup
- `pub.chive.actor.getMyRoles` XRPC endpoint for querying the authenticated user's roles
- Direct alpha access grant dialog on the admin alpha management page
- Lexicon schemas for admin and actor role endpoints

#### Granular ATProto OAuth Scopes

- Permission set lexicon schemas (`basicReader`, `authorAccess`, `reviewerAccess`, `fullAccess`) following the ATProto `permission-set` Lexicon type
- Hierarchical permission model: basicReader (read-only RPC) < authorAccess (eprint/profile writes + claiming + blobs) < reviewerAccess (reviews + annotations) < fullAccess (graph governance + proposals)
- Scope constants for all 19 `pub.chive.*` repo collections, 6 external namespace collections (Bluesky, Standard, Cosmik), and 5 blob MIME type wildcards
- `buildScopeString` utility for constructing space-separated OAuth scope strings with automatic `atproto` prefix and deduplication
- Intent-based login flow with `AuthIntent` type (`browse`, `submit`, `review`, `full`) that requests only the scopes needed for each activity
- Frontend `getScopesForIntent` and `hasScope` utilities with `transition:generic` backward compatibility
- `CLIENT_METADATA_SCOPE` constant combining full access permission set with all external namespace scopes
- OAuth client metadata updated to declare granular scopes alongside `transition:generic` for backward compatibility with PDSes that don't support granular scopes

#### Deployment

- Docker smoke tests and staging deployment workflow with environment branch strategy
- `NEXT_PUBLIC_CHIVE_SERVICE_DID` build arg for per-environment service DID configuration

#### Observability

- Prometheus metric groups for jobs, workers, auth, search, blob proxy, dead letter queue, admin, and backfill operations
- OpenTelemetry span instrumentation for auth verification, background jobs, worker processing, and blob proxy requests
- Faro error boundary around eprint detail page for rendering crash diagnostics with trace ID references

#### Indexing

- Field label resolution job and indexer retry for unresolved UUID field labels
- `makeJobId` utility for sanitizing AT URIs into valid BullMQ job identifiers

#### Documentation

- Admin dashboard documentation covering API endpoints, backfill operations, observability metrics, architecture, and role management
- OAuth scopes documentation covering permission set definitions, intent-based login, and backward compatibility
- Documentation suite overhaul with formatting improvements, accuracy corrections, and staging deploy workflow

#### Testing

- Unit tests for AdminService, BackfillManager, admin XRPC handlers, admin seed script, and observability Prometheus instrumentation
- Frontend unit tests for admin hooks, admin auth guard, and role hooks
- Backend and frontend unit tests for OAuth scope constants, permission sets, `buildScopeString`, `getScopesForIntent`, and `hasScope`

### Changed

- Collection visibility renamed from `public`/`private` to `listed`/`unlisted` across lexicon, backend, frontend, and tests to reflect ATProto semantics (visibility controls AppView listing, not data access)
- PostgreSQL migration to rename existing visibility column values with backward-compatible normalization for old values
- GitHub Actions CI workflows updated with `ADMIN_DIDS` environment variable, admin health check endpoints, and expanded Prometheus metrics collection targets
- Documentation accuracy: removed non-existent content moderation features, corrected role names, fixed contact emails, replaced Semble references with Cosmik
- OAuth scope requests fall back to `transition:generic` until PDSes support granular permission sets
- Grafana Alloy Faro log pipeline switched from JSON stage to regex stages for Faro's key=value log format

### Fixed

- React 19 + Radix UI infinite loop crash (error #185) when selecting endorsement types by replacing Radix Checkbox with native HTML input
- BullMQ job ID validation errors caused by colons in AT URIs by sanitizing job IDs in enrichment, freshness, and index-retry workers
- AlphaGate redirecting approved users to login on transient auth refetch failures
- Null reference crashes on eprint detail page from missing `abstract`, endorser display names, or contribution arrays
- ~90 incorrect Wikidata Q-IDs across governance seed data
- Invalid lexicon schemas for citation record and listCitations query
- Permission set scopes to cover all frontend writes including external namespaces and blob types
- Docker smoke test to use `/ready` endpoint instead of nonexistent `/xrpc/_health`
- Backend `SERVICE_DID` environment variable name to match deploy configuration
- Reindex script to use MERGE instead of CREATE to handle Neo4j uniqueness constraints
- Staging deploy to pull from `origin/staging` instead of `origin/main`
- Admin role reference from `moderator` to `admin` in getPendingClaims endpoint
- Alpha applications table sync when granting access via admin role assignment
- Permission-set lexicons excluded from codegen to prevent build errors
- Neo4j Cypher syntax error in recommendation queries that prevented related papers from loading (moved `UNION ALL` inside `CALL {}` blocks for Neo4j 5.x compatibility)

## [0.1.0] - 2026-03-03

Initial release of Chive, a decentralized eprint service built on AT Protocol.

### Added

#### Core Architecture

- ATProto-native AppView that indexes scholarly records from the relay firehose without writing to user PDSes
- Hono-based API framework serving both XRPC and REST endpoints (~130 XRPC endpoints across 19 service areas)
- Modular service architecture with all services behind abstract `I*` interfaces for dependency injection
- Multi-database storage layer: PostgreSQL (metadata indexes), Elasticsearch (full-text search), Neo4j (knowledge graph), Redis (caching and rate limiting)
- All database tables use `_index` suffix and track PDS source URLs for staleness detection and rebuild-from-firehose capability
- Plugin system with hybrid TSyringe (DI) and EventEmitter2 (hooks) architecture, isolated-vm sandboxing, and declared permissions
- Background worker system with enrichment, freshness, and index-retry workers
- Scheduled jobs for citation extraction, field promotion, governance sync, graph algorithms, PDS scanning, and tag sync
- OAuth-based authentication with DID resolution, session management, and ATProto identity verification
- Rate limiting with configurable fail-open/fail-closed behavior when Redis is unavailable

#### Firehose Indexing and PDS Discovery

- Firehose consumer with WebSocket connection to ATProto relay, filtering for all `pub.chive.*` collections
- Support for both full firehose events (CAR/CBOR parsing) and Jetstream events (pre-decoded JSON)
- Cursor management with batched persistence to PostgreSQL for resumption after restarts
- Dead letter queue for failed events with error classification (transient, permanent, rate limit) and exponential backoff retry
- Backpressure handling to prevent memory exhaustion when queue depth exceeds threshold
- Reconnection manager with exponential backoff and jitter for network failure recovery
- PDS Discovery system with three discovery sources: PLC directory enumeration, relay listHosts queries, and DID mention extraction
- PDS Scanner that backfills records from all 19 `pub.chive.*` collections on discovered PDSes
- PDS registry with scan priority scheduling (24h for active, 7d for inactive) and consecutive failure tracking
- User-facing `pub.chive.sync.registerPDS` endpoint for self-hosted PDS registration
- Graceful shutdown with queue draining and cursor flushing

#### Lexicon Schemas

- 164 lexicon JSON schemas across 21 namespaces under the `pub.chive.*` namespace
- Record types for eprints (`submission`, `version`, `changelog`, `tag`, `userTag`, `citation`, `relatedWork`)
- Record types for reviews (`comment`, `endorsement`, `entityLink`)
- Record types for annotations (`comment`, `entityLink`)
- Record types for the knowledge graph (`node`, `edge`, `nodeProposal`, `edgeProposal`, `vote`)
- Record types for actor profiles (`profile`, `profileConfig`)
- Query and procedure schemas for collections, discovery, governance, claiming, metrics, activity, tags, backlinks, sync, notifications, and import
- Lexicon code generation pipeline producing TypeScript types and runtime `isRecord` type guards
- Rich text facet definitions for cross-references

#### Eprint Management

- Eprint submission with structured metadata: title, abstract, keywords, authors with affiliations and contribution types, publication tracking
- Eprint versioning with version number tracking, previous version references, and change descriptions
- Eprint changelog tracking for edit history
- LaTeX-to-Unicode abstract migration with `needsAbstractMigration` schema hint detection
- License metadata with URI-based license identification
- PDF blob reference storage (CID pointers only, never blob data) with on-demand PDS fetching
- Eprint soft deletion support
- OG image generation for social media sharing

#### Search and Discovery

- Full-text search powered by Elasticsearch with KStem stemmer, `bool_prefix` queries, and field-specific boosting
- Faceted search filtering by field, author, date range, keywords, and publication status
- Search autocomplete with search-as-you-type suggestions
- Personalized discovery dashboard with multi-signal scoring (field affinity, citation overlap, recency, collaborative filtering)
- "For You" feed with personalized paper recommendations
- Similar papers with "More Like This" fallback when primary signals are insufficient
- Field-filtered trending eprints
- Citation-based paper discovery
- Dismiss flow for unwanted suggestions with `recordInteraction` tracking
- Elasticsearch index lifecycle management policies, ingest pipelines, and index templates

#### Knowledge Graph

- Community-governed taxonomy using SKOS/FAST faceted classification stored in Neo4j
- Node types: fields, methods, datasets, tools, platforms, licenses, and custom personal nodes
- Edge types with semantic relation labels (broader, narrower, related, applied-to, uses, etc.)
- Bidirectional edge support with configurable directionality
- Graph hierarchy browsing with faceted navigation
- Subgraph expansion for exploring node neighborhoods
- Community detection, PageRank, and centrality graph algorithms
- Wikidata integration via SPARQL for external identifier enrichment
- Node autocomplete with search-as-you-type across all node types
- Node proposals and community voting for Wikipedia-style moderation
- Governance PDS (`did:plc:chive-governance`) for storing community-approved authority records as ATProto-native portable data
- Governance sync job for periodic authority record synchronization
- Trusted editor elevation requests with approval/rejection workflow
- Role delegation system for governance authority distribution

#### Collections

- User-owned collections stored as personal graph nodes in user PDSes
- Collection wizard with multi-step creation flow (basics, items, edges, structure, cosmik integration, review)
- Subcollection nesting with `SUBCOLLECTION_OF` edges and automatic parent propagation on add
- Add-to-collection buttons on eprint, review, endorsement, and graph node cards throughout the UI
- Inter-item edge editing for creating relationships between items within a collection
- Collection activity feeds tracking changes to watched items
- Collection search, public listing, and owner listing
- Hierarchical collection dashboard with depth-based indentation and expand/collapse
- Direct-only vs all-items view toggle for subcollection content
- Delete propagation from subcollections to parent collections
- Drag-and-drop item reordering
- Cosmik dual-write integration for cross-platform collection mirroring
- Nine XRPC endpoints for collection management

#### Review System

- Inline review comments with threaded discussion support
- Formal endorsement records with contribution type classification (methodology, results, novelty, clarity, significance, overall)
- Endorsement summary aggregation per eprint
- Entity linking from review text spans to knowledge graph nodes
- Review listing by eprint and by author
- Thread context retrieval for navigating discussion hierarchies
- Notifications for new reviews and endorsements on authored papers

#### Annotation System

- Inline text annotations on eprint PDFs using W3C Web Annotation data model
- Text selection anchoring with highlight persistence
- Entity link annotations connecting selected text spans to knowledge graph entities
- Annotation sidebar with navigation and deletion
- Dedicated annotation lexicon schemas separated from review system
- Annotation listing by eprint, by page, and by author

#### Citation and Related Works

- Citation extraction pipeline with GROBID integration for parsing reference sections from PDFs
- Extracted citation indexing in PostgreSQL with eprint cross-referencing
- User-curated related works linking between eprints
- Related papers panel with unified display of extracted citations and curated links
- Citation-based discovery signals feeding into recommendation engine

#### Author Profiles and Claiming

- Actor profile records with display name, bio, ORCID identifier, and institutional affiliations
- Profile configuration with customizable display sections
- Featured collection display on author profile pages
- Author claiming workflow with coauthor verification for papers imported from external sources
- Coauthorship request and approval/rejection flow
- Autocomplete for ORCID, affiliations, keywords, and OpenReview profiles
- External paper claiming from arXiv, OpenReview, and other integrated sources
- Claimable paper suggestions with dismiss capability

#### Tags and Classification

- Author-assigned tags on eprint submission
- User-contributed tags (folksonomy) with quality scoring
- Tag trending with time-decay algorithms
- Tag search and autocomplete
- Tag detail pages showing tagged eprints
- Tag suggestions based on eprint content
- Tag sync job for periodic data consistency

#### Backlinks

- Cross-platform backlink aggregation from Bluesky, Cosmik, Whitewind, and Leaflet
- Backlink creation and deletion endpoints
- Backlink count aggregation per eprint
- Cosmik backlink source type support

#### Metrics and Activity

- View, download, and dwell time recording for eprints
- Search click and search download tracking
- Trending calculation based on engagement metrics
- Activity feed logging with correlation metrics
- Failed activity tracking for monitoring

#### Built-in Plugins

- arXiv plugin with paper search and metadata retrieval
- OpenReview plugin for conference paper search
- PsyArXiv plugin for psychology preprint search via OSF API
- LingBuzz plugin for linguistics preprint scraping with respectful rate limiting
- Semantics Archive plugin for semantic web publication scraping
- Plugin import scheduling with configurable intervals and run-on-start support
- Bluesky, Cosmik, Whitewind, and Leaflet backlink plugins
- Plugin framework with lifecycle management, hook system, and sandboxed execution

#### Frontend

- Next.js 15 application with React 19 and App Router
- 68 page routes covering search, eprints, authors, collections, governance, dashboard, submission, discovery, and authentication
- 350+ React components organized by domain
- TanStack Query data fetching with optimistic updates and cache management
- TipTap rich text editor with cross-reference `[[` autocomplete for knowledge graph entities
- PDF viewer with text selection, highlight anchoring, and annotation overlay
- Responsive design with mobile-friendly tab scrolling
- Radix UI component library with Tailwind CSS styling
- Grafana Faro frontend observability with configurable trace and session sampling

#### Observability and Monitoring

- OpenTelemetry instrumentation for distributed tracing across all services
- Grafana Alloy agent for receiving frontend Faro and backend OTLP telemetry
- Tempo for distributed trace storage and querying
- Loki for centralized log aggregation
- Prometheus metrics collection with custom Chive metrics (indexing events, queue depth, lag, PDS scan durations)
- Grafana dashboards for visualization
- Structured JSON logging with configurable log levels
- Health check endpoints (`/health`, `/readiness`) with detailed service status

#### Infrastructure

- Multi-stage Docker build with separate `production` and `development` targets
- Docker Compose configurations for production, local development, observability, and documentation
- Traefik reverse proxy with automatic Let's Encrypt SSL certificate management
- Governance PDS container running Bluesky PDS image for authority record storage
- GROBID container for PDF citation extraction with tuned memory limits and health check timing
- Kubernetes manifests with Helm charts, horizontal pod autoscaling, pod disruption budgets, and RBAC
- CI pipeline with 7 jobs: unit tests, type checking, lint and format, ATProto compliance, integration tests, build, and deploy
- Automated deployment via GitHub Actions with environment file generation, Docker image building, and post-deploy verification
- Build cache cleanup to prevent disk space accumulation from `--no-cache` Docker builds
- Separate indexer process for resource isolation from the API server

#### Documentation

- Docusaurus documentation site with auto-generated interactive API docs from OpenAPI specification
- User guide covering searching, submitting eprints, editing, peer review, endorsements, profiles, authorship claiming, tags, collections, discovery, and Bluesky sharing
- Developer guide covering API layer, authentication, core services, lexicon validation, frontend architecture, rich text, eprint lifecycle, and observability
- Service documentation for indexing, collections, discovery, claiming, and PDS discovery
- Plugin documentation with creation guide and built-in plugin reference
- Storage documentation for PostgreSQL, Elasticsearch, Neo4j, and Redis
- Architecture overview, concepts (AT Protocol, knowledge graph, data sovereignty), governance, operations, and reference documentation

#### Testing

- ATProto compliance test suite with 100% pass rate requirement validating data sovereignty principles
- End-to-end test suite with 42 Playwright test files covering all major user workflows
- Integration test suite with 32 test files covering API endpoints, services, and storage layers
- Unit test suite with 134 test files covering handlers, services, storage adapters, plugins, and utilities
- Test infrastructure with Docker test stack, seed data scripts, and cleanup utilities

[Unreleased]: https://github.com/chive-pub/chive/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/chive-pub/chive/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/chive-pub/chive/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/chive-pub/chive/releases/tag/v0.1.0
