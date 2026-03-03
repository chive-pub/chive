# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-03-03

Initial release of Chive, a decentralized eprint service built on AT Protocol.

### Added

- ATProto-native AppView architecture with read-only firehose indexing
- XRPC API layer built on Hono with lexicon schema validation
- Firehose consumer with cursor tracking, reconnection management, and dead letter queue
- PDS discovery and scanning for backfilling records not seen on the relay
- OAuth-based authentication with DID resolution and session management
- Eprint submission, versioning, and changelog tracking
- Full-text search with KStem stemmer, bool_prefix queries, and faceted filtering
- Citation extraction pipeline with GROBID integration
- Related works linking and discovery
- User tagging with quality scoring and trending
- OG image generation for social sharing
- Inline review comments with W3C Web Annotation anchoring
- Formal endorsement records with contribution types
- Threaded review discussions
- Entity linking from review text spans to knowledge graph nodes
- Community-governed taxonomy with SKOS/FAST faceted classification
- Personal graph with user-owned nodes and edges stored in PDSes
- Graph proposals and voting for community moderation
- Wikidata integration via SPARQL for external identifiers
- Node autocomplete with search-as-you-type
- User-owned collections with subcollection nesting
- Collection activity feeds tracking watched items
- Add-to-collection buttons throughout the UI
- Inter-item edge editing within collections
- Subcollection item view toggle (all items vs direct only)
- Delete propagation from subcollections to parent collections
- Cosmik dual-write integration for cross-platform mirroring
- Annotation system with dedicated lexicon schemas
- PDF viewer with text selection and highlight anchoring
- Entity link annotations connecting text spans to graph entities
- Annotation sidebar with navigation and deletion
- Personalized discovery dashboard with multi-signal scoring
- Field-filtered trending eprints
- Author claiming with coauthor verification
- More Like This fallback for related paper suggestions
- Dismiss flow for unwanted suggestions
- Actor profiles with display name, bio, ORCID, and affiliations
- Profile configuration with customizable sections
- Featured collection display on author pages
- Next.js 15 frontend with React 19 and App Router
- TanStack Query data fetching with optimistic updates
- TipTap rich text editor with cross-reference autocomplete
- Responsive design with mobile-friendly tab scrolling
- ATProto compliance test suite with 100% pass rate requirement
- Docusaurus documentation site with auto-generated API docs

[Unreleased]: https://github.com/chive-pub/chive/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/chive-pub/chive/releases/tag/v0.1.0
