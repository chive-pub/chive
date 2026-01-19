# AT Protocol Infrastructure

Read-only AT Protocol client infrastructure for Chive AppView.

## Overview

This module provides ATProto-compliant implementations for accessing user repositories (PDSes). As an AppView, Chive only reads data - it never writes to user PDSes.

## Directory Structure

```
atproto/
├── index.ts              # Module exports
├── repository/           # Repository access
│   ├── at-repository.ts  # Main ATRepository class
│   └── at-repository.config.ts
└── errors/               # ATProto-specific errors
    └── repository-errors.ts
```

## Components

### ATRepository

Read-only access to AT Protocol repositories:

```typescript
import { ATRepository } from './atproto/index.js';

const repo = new ATRepository(config);

// Get a single record
const record = await repo.getRecord('did:plc:example', 'pub.chive.eprint.submission', 'rkey123');

// List records in a collection
for await (const record of repo.listRecords('did:plc:example', 'pub.chive.eprint.submission')) {
  console.log(record);
}

// Fetch blob from user's PDS (not stored by Chive)
const blob = await repo.getBlob('did:plc:example', blobCid);
```

### Error Types

- `PDSConnectionError` - Failed to connect to user's PDS
- `IdentityResolutionError` - DID resolution failed
- `RecordFetchError` - Record not found or malformed
- `BlobFetchError` - Blob fetch failed

## ATProto Compliance

This module strictly follows ATProto AppView requirements:

| Principle       | Implementation                        |
| --------------- | ------------------------------------- |
| Read-only       | No write methods exposed              |
| PDS agnostic    | Works with any compliant PDS          |
| DID-based       | All access via DIDs, not handles      |
| Blob references | Fetches blobs on-demand, never stores |

## Related Documentation

- [ATProto Compliance](../../.claude/design/00-atproto-compliance.md)
- [AT Protocol Specification](https://atproto.com/specs)
