# Compliance Tests

ATProto compliance validation tests ensuring Chive adheres to AT Protocol principles and best practices.

## Overview

These tests verify that Chive's implementation follows ATProto requirements, including proper handling of firehose events, data sovereignty, blob references, and protocol compliance across all system layers.

## Test Files

| File                                | Description                                 |
| ----------------------------------- | ------------------------------------------- |
| `api-layer-compliance.test.ts`      | API endpoint ATProto compliance             |
| `auth-compliance.test.ts`           | Authentication and authorization compliance |
| `core-services-compliance.test.ts`  | Core service layer compliance               |
| `database-compliance.test.ts`       | Database storage compliance                 |
| `discovery-compliance.test.ts`      | Discovery service compliance                |
| `firehose-compliance.test.ts`       | Firehose consumer compliance                |
| `frontend-compliance.test.ts`       | Frontend ATProto compliance                 |
| `lexicon-compliance.test.ts`        | Lexicon schema compliance                   |
| `neo4j-compliance.test.ts`          | Neo4j knowledge graph compliance            |
| `observability-compliance.test.ts`  | Observability layer compliance              |
| `phase-14-compliance.test.ts`       | Phase 14 implementation compliance          |
| `plugin-atproto-compliance.test.ts` | Plugin system ATProto compliance            |
| `plugin-source-compliance.test.ts`  | Plugin source code compliance               |
| `search-compliance.test.ts`         | Search indexing compliance                  |

## Running Tests

```bash
# Run all compliance tests
pnpm test:compliance

# Run specific compliance test
pnpm test -- tests/compliance/firehose-compliance.test.ts

# Run with verbose output
pnpm test:compliance -- --reporter=verbose
```

## Key Compliance Rules

1. **No PDS Writes**: Chive never writes to user PDSes
2. **BlobRefs Only**: Store blob references (CIDs), never blob data
3. **Rebuildable Indexes**: All data must be rebuildable from firehose
4. **PDS Tracking**: Track source PDS for staleness detection
5. **Data Sovereignty**: Users own their data in their PDSes

## Coverage Requirements

- **100% pass rate required** for all compliance tests
- PRs that modify data flow must pass compliance tests before merge

## Related Documentation

- `.claude/design/00-atproto-compliance.md` - ATProto compliance principles
- `.claude/design/02-appview/indexing-pipeline.md` - Firehose indexing design
