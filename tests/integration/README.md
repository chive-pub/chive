# Integration Tests

Integration tests that verify component interactions with real or simulated external dependencies.

## Overview

These tests validate the integration between services, databases, and external systems. They require the test Docker stack to be running.

## Directory Structure

```
integration/
├── api/
│   ├── rate-limiting.test.ts
│   ├── rest/v1/
│   │   └── eprints.test.ts
│   └── xrpc/
│       ├── alpha.test.ts
│       ├── eprint.test.ts
│       ├── governance-trusted-editor.test.ts
│       └── graph.test.ts
├── governance/
│   ├── contribution-type-proposal-lifecycle.test.ts
│   ├── elevation-request-lifecycle.test.ts
│   ├── facet-proposal-lifecycle.test.ts
│   ├── organization-proposal-lifecycle.test.ts
│   └── reconciliation-proposal-lifecycle.test.ts
├── lexicons/
│   └── codegen.test.ts
├── observability/
│   └── tracing.test.ts
├── plugins/
│   ├── event-propagation.test.ts
│   ├── plugin-lifecycle.test.ts
│   └── sandbox-security.test.ts
├── services/
│   ├── blob-proxy/
│   │   └── blob-proxy-service.integration.test.ts
│   ├── discovery/
│   │   ├── citation-indexing.integration.test.ts
│   │   └── recommendation-pipeline.integration.test.ts
│   ├── eprint/
│   │   └── eprint-service.integration.test.ts
│   ├── metrics/
│   │   └── metrics-service.integration.test.ts
│   ├── pds-discovery/
│   │   └── pds-discovery.integration.test.ts
│   ├── pds-sync/
│   │   └── sync-service.integration.test.ts
│   └── review/
│       └── review-service.integration.test.ts
├── storage/
│   ├── elasticsearch-search.test.ts
│   ├── elasticsearch-templates.test.ts
│   ├── neo4j-schema.test.ts
│   ├── postgresql-facet-usage-history.test.ts
│   ├── postgresql-schema.test.ts
│   └── redis-structures.test.ts
├── author-indexing.test.ts
└── firehose-author-records.test.ts
```

## Running Tests

```bash
# Start test infrastructure
./scripts/start-test-stack.sh

# Run all integration tests
pnpm test:integration

# Run specific test file
pnpm test -- tests/integration/api/xrpc/eprint.test.ts

# Run tests for a specific area
pnpm test -- tests/integration/storage/
pnpm test -- tests/integration/governance/
```

## Test Categories

### API Integration

Tests for REST and XRPC endpoints with real request/response cycles.

### Governance Integration

Tests for proposal lifecycle workflows including creation, voting, and approval.

### Plugin Integration

Tests for plugin lifecycle, event propagation, and sandbox security.

### Service Integration

Tests for service interactions with external systems like Elasticsearch, Redis, and PDS.

### Storage Integration

Tests for database schema, queries, and data persistence.

## Test Infrastructure

The test stack includes:

- PostgreSQL 16
- Elasticsearch 8
- Neo4j 5
- Redis 7
- Mock PDS server

Start with `./scripts/start-test-stack.sh` and seed with `pnpm seed:test`.

## Related

- `tests/unit/` - Unit tests (no external dependencies)
- `tests/e2e/` - End-to-end browser tests
- `.claude/design/13-testing/` - Testing strategy documentation
