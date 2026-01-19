# API Layer

Hono-based API server for Chive, providing XRPC (AT Protocol) and REST endpoints.

## Overview

The API layer implements the AppView interface for Chive, serving as a read-only indexer for AT Protocol records. It uses the Hono web framework and provides both XRPC endpoints (AT Protocol standard) and REST endpoints (for traditional API consumers).

## Directory Structure

```
api/
├── config.ts                  # API configuration (CORS, rate limits, pagination)
├── routes.ts                  # Route registration
├── server.ts                  # Hono application factory
├── handlers/
│   ├── index.ts               # Handler barrel exports
│   ├── rest/                  # REST API handlers
│   │   ├── health.ts          # Health check endpoints
│   │   └── v1/                # REST v1 endpoints
│   │       ├── eprints.ts     # Eprint CRUD operations
│   │       ├── integrations.ts # External service integrations
│   │       └── search.ts      # Search endpoints
│   └── xrpc/                  # XRPC handlers (AT Protocol)
│       ├── activity/          # Activity logging and feed
│       ├── actor/             # User profile and autocomplete
│       ├── alpha/             # Alpha access management
│       ├── author/            # Author profiles
│       ├── backlink/          # Backlink tracking (Bluesky, etc.)
│       ├── claiming/          # Paper claiming workflow
│       ├── discovery/         # Recommendations and similar papers
│       ├── endorsement/       # Eprint endorsements
│       ├── eprint/            # Eprint operations
│       ├── governance/        # Community governance voting
│       ├── import/            # External paper import
│       ├── metrics/           # View/download tracking
│       ├── notification/      # User notifications
│       ├── review/            # Reviews and comments
│       ├── sync/              # PDS synchronization
│       └── tag/               # Tag management
├── middleware/
│   ├── auth.ts                # ATProto service auth middleware
│   ├── error-handler.ts       # Global error handling
│   ├── index.ts               # Middleware barrel exports
│   ├── rate-limit.ts          # Redis-based rate limiting
│   ├── request-context.ts     # Request ID, timing, logging
│   └── validation.ts          # Request validation middleware
├── schemas/                   # OpenAPI/Zod schemas
└── types/
    ├── context.ts             # Hono context types
    ├── handlers.ts            # Handler type definitions
    └── index.ts               # Type barrel exports
```

## Key Files

- **server.ts**: Application factory with middleware stack (security headers, CORS, service injection, auth, rate limiting, error handling)
- **config.ts**: Centralized configuration for rate limits, CORS origins, pagination defaults, and security headers
- **routes.ts**: Route registration connecting handlers to endpoints

## Configuration

Key environment variables:

- `CORS_ORIGINS`: Comma-separated list of additional CORS origins
- `DISABLE_RATE_LIMITING`: Set to `true` to disable rate limiting (testing only)
- `RATE_LIMIT_FAIL_MODE`: `open` or `closed` behavior when Redis is unavailable
- `STALENESS_THRESHOLD_MS`: Threshold for marking records as stale (default: 7 days)

## Rate Limits

| Tier          | Requests/minute |
| ------------- | --------------- |
| Anonymous     | 60              |
| Authenticated | 300             |
| Premium       | 1000            |
| Admin         | 5000            |

## Usage Example

```typescript
import { createServer } from './server.js';

const app = createServer({
  eprintService,
  searchService,
  metricsService,
  graphService,
  blobProxyService,
  reviewService,
  tagManager,
  // ... other services
  redis,
  logger,
  serviceDid: 'did:web:chive.pub',
  authzService,
  alphaService,
});

// Start server
serve({ fetch: app.fetch, port: 3000 });
```

## Endpoint Prefixes

- XRPC: `/xrpc` (e.g., `/xrpc/pub.chive.eprint.getSubmission`)
- REST: `/api/v1` (e.g., `/api/v1/eprints`)
- Health: `/health`, `/ready`
- OpenAPI: `/openapi.json`, `/docs`
