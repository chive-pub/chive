# Services

Business logic and domain services for Chive.

## Overview

The services layer implements core business logic, coordinating between storage adapters, external APIs, and the indexing pipeline. Services follow the dependency injection pattern and use abstract interfaces for testability.

## Directory Structure

```
services/
├── activity/                    # Activity tracking
│   ├── index.ts                 # Barrel exports
│   └── activity-service.ts      # Activity feed and logging
├── alpha/                       # Alpha access
│   └── alpha-application-service.ts  # Alpha waitlist management
├── backlink/                    # Backlink tracking
│   ├── index.ts                 # Barrel exports
│   └── backlink-service.ts      # Cross-platform mention tracking
├── blob-proxy/                  # Blob proxying (PDFs, images)
│   ├── cid-verifier.ts          # CID verification
│   ├── cdn-adapter.ts           # CDN integration
│   ├── proxy-service.ts         # Blob fetch and cache
│   ├── redis-cache.ts           # L2 blob caching
│   └── request-coalescer.ts     # Deduplicates concurrent requests
├── claiming/                    # Paper claiming
│   ├── index.ts                 # Barrel exports
│   └── claiming-service.ts      # Paper ownership workflow
├── common/                      # Shared utilities
│   ├── error-classifier.ts      # Error categorization
│   └── resilience.ts            # Circuit breakers, retries
├── content-extraction/          # Document processing
│   ├── index.ts                 # Barrel exports
│   ├── document-extractor.ts    # PDF/document parsing
│   └── format-detector.ts       # MIME type detection
├── discovery/                   # Content discovery
│   ├── index.ts                 # Barrel exports
│   └── discovery-service.ts     # Recommendations and similar papers
├── email/                       # Email notifications
│   ├── email-service.ts         # SMTP sending
│   └── templates/               # Email templates
│       └── alpha-approval.ts    # Alpha approval email
├── eprint/                      # Eprint operations
│   ├── eprint-service.ts        # Core eprint logic
│   ├── pds-record-transformer.ts # PDS record transformation
│   └── version-manager.ts       # Version history management
├── governance/                  # Community governance
│   ├── edge-service.ts          # Graph edge operations
│   ├── governance-pds-connector.ts  # Governance PDS reads
│   ├── governance-pds-writer.ts     # Governance PDS writes
│   ├── node-service.ts          # Graph node operations
│   └── trusted-editor-service.ts    # Editor role management
├── import/                      # External paper import
│   ├── index.ts                 # Barrel exports
│   └── import-service.ts        # Import orchestration
├── indexing/                    # Firehose indexing
│   ├── commit-handler.ts        # Commit processing
│   ├── cursor-manager.ts        # Firehose cursor tracking
│   ├── dlq-handler.ts           # Dead letter queue
│   ├── error-classifier.ts      # Indexing error types
│   ├── event-filter.ts          # Event filtering
│   ├── event-processor.ts       # Event processing
│   ├── event-queue.ts           # Event buffering
│   ├── firehose-consumer.ts     # ATProto firehose client
│   ├── indexing-service.ts      # Indexing orchestration
│   └── reconnection-manager.ts  # Connection recovery
├── knowledge-graph/             # Knowledge graph operations
│   ├── graph-service.ts         # Graph queries and mutations
│   └── proposal-service.ts      # Governance proposals
├── metadata-enrichment/         # Metadata enrichment
│   ├── index.ts                 # Barrel exports
│   └── crossref-enrichment.ts   # Crossref metadata fetch
├── metrics/                     # View/download metrics
│   └── metrics-service.ts       # Metrics tracking
├── notification/                # Real-time notifications
│   ├── notification-service.ts  # Notification dispatch
│   ├── sse-handler.ts           # Server-sent events
│   └── websocket-handler.ts     # WebSocket connections
├── pds-discovery/               # PDS discovery
│   ├── index.ts                 # Barrel exports
│   ├── discovery-service.ts     # PDS endpoint discovery
│   ├── pds-registry.ts          # Known PDS tracking
│   ├── pds-scanner.ts           # PDS record scanning
│   └── relay-host-tracker.ts    # Relay host management
├── pds-sync/                    # PDS synchronization
│   ├── pds-rate-limiter.ts      # Per-PDS rate limiting
│   └── sync-service.ts          # Record sync from PDSes
├── reconciliation/              # Authority reconciliation
│   ├── index.ts                 # Barrel exports
│   └── reconciliation-service.ts # Entity deduplication
├── review/                      # Reviews and comments
│   ├── review-service.ts        # Review operations
│   └── threading-handler.ts     # Comment threading
├── search/                      # Search functionality
│   ├── index.ts                 # Barrel exports
│   ├── category-matcher.ts      # Category classification
│   ├── category-taxonomy.ts     # Category hierarchy
│   ├── judgment-list-exporter.ts # LTR training export
│   ├── ranking-service.ts       # Search ranking
│   ├── relevance-logger.ts      # Click/dwell logging
│   ├── search-service.ts        # Search orchestration
│   └── text-scorer.ts           # Text relevance scoring
└── zulip/                       # Zulip integration
    └── zulip-service.ts         # Zulip messaging
```

## Key Services

### IndexingService

Processes AT Protocol firehose events:

- Consumes from relay WebSocket
- Filters for `pub.chive.*` records
- Updates PostgreSQL/Elasticsearch indexes
- Handles reconnection and cursor tracking

### EprintService

Core eprint operations:

- Record indexing and retrieval
- Version management
- Author attribution
- PDS record transformation

### SearchService

Full-text and faceted search:

- Elasticsearch query building
- Faceted filtering
- Relevance ranking
- LTR training data collection

### DiscoveryService

Content recommendations:

- Similar paper detection
- Personalized feeds
- Citation-based suggestions

### ClaimingService

Paper ownership workflow:

- Claim initiation
- Co-author verification
- Approval/rejection flow

## ATProto Compliance

Services follow AppView principles:

- **Read-only indexing**: Never write to user PDSes
- **BlobRef only**: Never store blob data, only CID references
- **Rebuildable**: All indexes can be rebuilt from firehose
- **PDS tracking**: Track source PDS for staleness detection

## Usage Example

```typescript
import { EprintService } from './eprint/eprint-service.js';
import { SearchService } from './search/search-service.js';

// Services receive dependencies via constructor
const eprintService = new EprintService({
  storage: postgresAdapter,
  search: elasticsearchAdapter,
  graph: neo4jAdapter,
  logger,
});

// Index an eprint from firehose event
await eprintService.indexEprint(event.uri, event.record, event.cid);

// Search eprints
const results = await searchService.search({
  query: 'neural networks',
  facets: { field: 'computer-science' },
  limit: 20,
});
```
