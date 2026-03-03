# PDS Discovery

The PDS Discovery system enables Chive to index records from Personal Data Servers (PDSes) that are not connected to the main relay firehose. This ensures comprehensive coverage of Chive records across the ATProto network.

## Problem

The primary data source for Chive is the relay firehose, which streams events from PDSes subscribed to the relay. However, some PDSes operate independently:

- Self-hosted PDSes not connected to any relay
- PDSes using alternative relays
- New PDSes with records created before connecting to a relay

Without proactive discovery, records on these PDSes would never appear in Chive's index.

## Components

The PDS Discovery system consists of three main components:

| Component             | Purpose                                       | Source                                            |
| --------------------- | --------------------------------------------- | ------------------------------------------------- |
| `PDSRegistry`         | Tracks known PDSes and their scan state       | `src/services/pds-discovery/pds-registry.ts`      |
| `PDSDiscoveryService` | Discovers PDSes from various sources          | `src/services/pds-discovery/discovery-service.ts` |
| `PDSScanner`          | Scans PDSes for all `pub.chive.*` collections | `src/services/pds-discovery/pds-scanner.ts`       |

### PDSRegistry

Maintains a database of known PDSes with their scan state:

```typescript
interface PDSRegistryEntry {
  pdsUrl: string;
  discoveredAt: Date;
  discoverySource: DiscoverySource;
  status: PDSStatus;
  lastScanAt?: Date;
  nextScanAt?: Date;
  hasChiveRecords?: boolean;
  chiveRecordCount: number;
  consecutiveFailures: number;
  scanPriority: number;
}

type PDSStatus = 'pending' | 'active' | 'scanning' | 'unreachable' | 'no_chive_records';

type DiscoverySource =
  | 'plc_enumeration' // Found via PLC directory
  | 'relay_listhosts' // Found via relay's listHosts
  | 'user_registration' // User-submitted PDS URL
  | 'did_mention'; // Found via DID in indexed record
```

Key methods:

```typescript
interface IPDSRegistry {
  registerPDS(pdsUrl: string, source: DiscoverySource): Promise<void>;
  getPDSesForScan(limit: number): Promise<PDSRegistryEntry[]>;
  markScanStarted(pdsUrl: string): Promise<void>;
  markScanCompleted(pdsUrl: string, result: ScanResult): Promise<void>;
  markScanFailed(pdsUrl: string, error: string): Promise<void>;
  getPDSStats(): Promise<{
    total: number;
    active: number;
    withChiveRecords: number;
    unreachable: number;
  }>;
}
```

### PDSDiscoveryService

Discovers PDSes from multiple sources:

**1. PLC Directory enumeration**

Streams the PLC directory export to find unique PDS endpoints:

```typescript
const discoveryService = new PDSDiscoveryService(registry, logger, redis);

// Stream through PLC directory (rate-limited)
for await (const pds of discoveryService.discoverFromPLCDirectory()) {
  console.log(`Found PDS: ${pds.pdsUrl} from ${pds.discoveredFrom}`);
}
```

**2. Relay listHosts**

Queries relays for their subscribed PDSes:

```typescript
const pdses = await discoveryService.discoverFromRelay('wss://bsky.network');
// Returns all PDSes known to the relay
```

**3. DID mentions**

Extracts PDS endpoints from DIDs found in indexed records:

```typescript
const authorDids = ['did:plc:abc123', 'did:plc:xyz789'];
const pdses = await discoveryService.discoverFromDIDMentions(authorDids);
```

### PDSScanner

Scans PDSes for all `pub.chive.*` records and indexes them via the appropriate services.

#### Instantiation

The scanner requires service dependencies for each record type it indexes:

```typescript
import { PDSScanner } from '@/services/pds-discovery/pds-scanner.js';
import { EprintService } from '@/services/eprint/eprint-service.js';
import { ReviewService } from '@/services/review/review-service.js';
import { CollectionService } from '@/services/collection/collection-service.js';
import { AnnotationService } from '@/services/annotation/annotation-service.js';
import { PersonalGraphService } from '@/services/personal-graph/personal-graph-service.js';

const scanner = new PDSScanner(
  registry,
  eprintService,
  reviewService,
  logger,
  { requestsPerMinute: 10, scanTimeoutMs: 60000, maxRecordsPerPDS: 1000 },
  collectionService,
  annotationService,
  personalGraphService,
  pool
);

// Scan a single PDS
const result = await scanner.scanPDS('https://pds.example.com');
console.log(`Found ${result.chiveRecordCount} records`);

// Scan multiple PDSes concurrently
const results = await scanner.scanMultiplePDSes(pdsUrls, 2);
```

#### Supported collections

The scanner indexes records from all `pub.chive.*` collections:

| Collection                        | Indexed via            | Description                                    |
| --------------------------------- | ---------------------- | ---------------------------------------------- |
| `pub.chive.eprint.submission`     | `EprintService`        | Core eprint submissions                        |
| `pub.chive.eprint.version`        | Direct SQL insert      | Eprint version metadata                        |
| `pub.chive.eprint.userTag`        | Direct SQL insert      | User-assigned tags on eprints                  |
| `pub.chive.eprint.tag`            | Direct SQL insert      | Author-assigned tags                           |
| `pub.chive.eprint.citation`       | Direct SQL insert      | Extracted and curated citations                |
| `pub.chive.eprint.relatedWork`    | Direct SQL insert      | Related paper links                            |
| `pub.chive.eprint.changelog`      | `EprintService`        | Eprint edit changelogs                         |
| `pub.chive.review.comment`        | `ReviewService`        | Review comments with threading                 |
| `pub.chive.review.endorsement`    | `ReviewService`        | Endorsements with contribution types           |
| `pub.chive.review.entityLink`     | `AnnotationService`    | Entity links on reviews                        |
| `pub.chive.graph.node`            | `PersonalGraphService` | Knowledge graph and personal nodes             |
| `pub.chive.graph.edge`            | `PersonalGraphService` | Graph edges (contains, subcollection-of, etc.) |
| `pub.chive.graph.nodeProposal`    | (logged only)          | Governance node proposals                      |
| `pub.chive.graph.edgeProposal`    | (logged only)          | Governance edge proposals                      |
| `pub.chive.graph.vote`            | (logged only)          | Governance votes                               |
| `pub.chive.annotation.comment`    | `AnnotationService`    | Inline text annotations                        |
| `pub.chive.annotation.entityLink` | `AnnotationService`    | Entity links on annotations                    |
| `pub.chive.actor.profile`         | Direct SQL insert      | Actor profile records                          |
| `pub.chive.actor.profileConfig`   | Direct SQL insert      | Profile display configuration                  |

Governance records (`nodeProposal`, `edgeProposal`, `vote`) are logged during scans but not fully indexed. Governance indexing is planned for a future release.

Each collection is scanned with cursor-based pagination, fetching up to 100 records per page and continuing until all records are retrieved or the per-PDS maximum is reached.

#### Record routing

The scanner routes records to the appropriate service based on collection type:

```typescript
// Simplified routing logic in indexRecord()
switch (collection) {
  case 'pub.chive.eprint.submission':
    const transformed = transformPDSRecord(record.value, uri, cid);
    await this.eprintService.indexEprint(transformed, metadata);
    break;

  case 'pub.chive.eprint.version':
    await this.indexVersion(uri, cid, record.value, pdsUrl);
    break;

  case 'pub.chive.review.comment':
    await this.reviewService.indexReview(record.value, metadata);
    break;

  case 'pub.chive.review.endorsement':
    await this.reviewService.indexEndorsement(record.value, metadata);
    break;

  case 'pub.chive.review.entityLink':
  case 'pub.chive.annotation.entityLink':
    await this.annotationService.indexEntityLink(record.value, metadata);
    break;

  case 'pub.chive.annotation.comment':
    await this.annotationService.indexAnnotation(record.value, metadata);
    break;

  case 'pub.chive.graph.node':
    await this.personalGraphService.indexNode(record.value, metadata);
    break;

  case 'pub.chive.graph.edge':
    await this.personalGraphService.indexEdge(record.value, metadata);
    break;

  case 'pub.chive.eprint.userTag':
  case 'pub.chive.eprint.tag':
    await this.indexUserTag(uri, cid, record.value, pdsUrl);
    break;

  case 'pub.chive.graph.nodeProposal':
  case 'pub.chive.graph.edgeProposal':
  case 'pub.chive.graph.vote':
    this.logger.debug('Scanned governance record', { uri, collection });
    break;
}
```

#### Runtime validation

Records are validated at runtime using generated lexicon type guards before indexing. This approach avoids unsafe type assertions and ensures schema compliance.

**For eprint submissions**, the scanner uses `transformPDSRecord()` which performs structural validation:

```typescript
import { transformPDSRecord } from '@/services/eprint/pds-record-transformer.js';

// Throws ValidationError if record is malformed
const eprint = transformPDSRecord(record.value, uri, cid);
```

**For reviews and endorsements**, `ReviewService` uses the generated `isRecord` type guards from the lexicon types:

```typescript
// In ReviewService.indexReview()
import {
  isRecord as isCommentRecord,
  type Main as CommentRecord,
} from '@/lexicons/generated/types/pub/chive/review/comment.js';

async indexReview(record: unknown, metadata: RecordMetadata): Promise<Result<void, ValidationError>> {
  // Runtime validation using generated type guard
  if (!isCommentRecord(record)) {
    return Err(new ValidationError(
      'Record does not match pub.chive.review.comment schema',
      'record',
      'schema'
    ));
  }

  // TypeScript now knows record is CommentRecord
  const comment = record as CommentRecord;
  // ... proceed with indexing
}
```

The generated `isRecord` function checks that:

1. The record is a non-null object
2. The `$type` field matches the expected lexicon ID (e.g., `pub.chive.review.comment`)
3. Required fields are present with correct types

This pattern provides type safety without relying on `as` casts or `any` types

## User registration endpoint

Users can register their PDS for scanning via the `pub.chive.sync.registerPDS` endpoint:

```http
POST /xrpc/pub.chive.sync.registerPDS

{
  "pdsUrl": "https://my-pds.example.com"
}
```

Response:

```json
{
  "pdsUrl": "https://my-pds.example.com",
  "registered": true,
  "status": "scanned",
  "message": "PDS registered and 5 record(s) indexed from your account."
}
```

If the user is authenticated, their DID is scanned immediately. Otherwise, the PDS is queued for the next scan cycle.

## Scheduled scanning

The `PDSScanSchedulerJob` runs periodic scans:

```typescript
const scanJob = new PDSScanSchedulerJob({
  registry,
  scanner,
  logger,
  scanIntervalMs: 900000, // 15 minutes
  batchSize: 5,
  concurrency: 2,
});

await scanJob.start();
```

Scan priority:

| Priority | Condition         | Scan frequency     |
| -------- | ----------------- | ------------------ |
| High     | Has Chive records | Every 24 hours     |
| Medium   | New/pending PDS   | Next scheduled run |
| Low      | No Chive records  | Every 7 days       |

Failed scans use exponential backoff (2^n hours, max 16 hours). After 5 consecutive failures, the PDS is marked as unreachable.

## ATProto compliance

The PDS Discovery system is fully compliant with ATProto principles:

- **Read-only**: Uses standard XRPC calls (`listRepos`, `listRecords`) to read from PDSes
- **Never writes**: Chive never writes to user PDSes
- **Rebuildable**: All indexed data can be rebuilt from source PDSes
- **Rate-limited**: Respects PDS rate limits (configurable requests per minute)

## Configuration

```typescript
interface PDSDiscoveryConfig {
  plcDirectoryUrl: string; // Default: 'https://plc.directory'
  plcRateLimitPerSecond: number; // Default: 5
  enabled: boolean; // Default: true
}

interface PDSScannerConfig {
  requestsPerMinute: number; // Default: 10
  scanTimeoutMs: number; // Default: 60000
  maxRecordsPerPDS: number; // Default: 1000
}
```

## Database schema

The registry uses a PostgreSQL table:

```sql
CREATE TABLE pds_registry (
  pds_url TEXT PRIMARY KEY,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discovery_source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_scan_at TIMESTAMPTZ,
  next_scan_at TIMESTAMPTZ,
  has_chive_records BOOLEAN,
  chive_record_count INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  scan_priority INTEGER NOT NULL DEFAULT 100,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Usage examples

### Manual PDS registration

```typescript
import { PDSRegistry } from '@/services/pds-discovery/pds-registry.js';

const registry = new PDSRegistry(pool, logger);
await registry.registerPDS('https://pds.example.com', 'user_registration');
```

### Running a discovery cycle

```typescript
import { PDSDiscoveryService } from '@/services/pds-discovery/discovery-service.js';

const discovery = new PDSDiscoveryService(registry, logger, redis);

// Discover from relays
const result = await discovery.runDiscoveryCycle(['wss://bsky.network', 'wss://bsky.social']);

console.log(`Discovered ${result.discovered} PDSes`);
```

### Scanning a specific DID

```typescript
import { PDSScanner } from '@/services/pds-discovery/pds-scanner.js';

const scanner = new PDSScanner(registry, eprintService, reviewService, logger);

// Scan a specific DID on a known PDS
const recordsIndexed = await scanner.scanDID('https://pds.example.com', 'did:plc:abc123');
```

The `scanDID` method scans all supported collections for the given DID and returns the total number of records indexed.

## Metrics

The PDSScanner exposes Prometheus metrics for observability:

| Metric                            | Type      | Labels                 | Description                     |
| --------------------------------- | --------- | ---------------------- | ------------------------------- |
| `chive_pds_scan_duration_seconds` | Histogram | `status`               | Duration of PDS scan operations |
| `chive_pds_scans_total`           | Counter   | `status`               | Total scan operations by status |
| `chive_pds_records_scanned`       | Counter   | `collection`           | Records scanned by collection   |
| `chive_pds_records_indexed`       | Counter   | `collection`, `status` | Records indexed by status       |
| `chive_pds_record_index_duration` | Histogram | `collection`           | Duration of record indexing     |

Status values for `chive_pds_records_indexed`:

- `success`: Record indexed successfully
- `error`: Indexing failed (validation or database error)
- `skipped`: Record type not yet supported (e.g., user tags)

## Related documentation

- [Indexing pipeline](./indexing.md): How records are processed after discovery
- [Data synchronization](../../concepts/data-sovereignty.md): ATProto data flow principles
- [API Reference](../../api-reference/xrpc-endpoints.md): `pub.chive.sync.*` endpoints
