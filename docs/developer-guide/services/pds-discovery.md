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

| Component             | Purpose                                 | Source                                            |
| --------------------- | --------------------------------------- | ------------------------------------------------- |
| `PDSRegistry`         | Tracks known PDSes and their scan state | `src/services/pds-discovery/pds-registry.ts`      |
| `PDSDiscoveryService` | Discovers PDSes from various sources    | `src/services/pds-discovery/discovery-service.ts` |
| `PDSScanner`          | Scans PDSes for Chive records           | `src/services/pds-discovery/pds-scanner.ts`       |

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

Scans PDSes for `pub.chive.*` records and indexes them:

```typescript
const scanner = new PDSScanner(registry, eprintService, logger, {
  requestsPerMinute: 10,
  scanTimeoutMs: 60000,
  maxRecordsPerPDS: 1000,
});

// Scan a single PDS
const result = await scanner.scanPDS('https://pds.example.com');
console.log(`Found ${result.chiveRecordCount} records`);

// Scan multiple PDSes concurrently
const results = await scanner.scanMultiplePDSes(pdsUrls, 2);
```

The scanner checks these collections:

- `pub.chive.eprint.submission`
- `pub.chive.review.comment`
- `pub.chive.review.endorsement`

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

const scanner = new PDSScanner(registry, eprintService, logger);

// Scan a specific DID on a known PDS
const recordsIndexed = await scanner.scanDID('https://pds.example.com', 'did:plc:abc123');
```

## Related documentation

- [Indexing pipeline](./indexing.md): How records are processed after discovery
- [Data synchronization](../../concepts/data-sovereignty.md): ATProto data flow principles
- [API Reference](../../api-reference/xrpc-endpoints.md): `pub.chive.sync.*` endpoints
