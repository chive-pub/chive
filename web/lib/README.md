# Lib Directory

This directory contains shared utilities, hooks, API clients, and type definitions for the Chive frontend.

## Directory Structure

| Directory/File | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| `api/`         | API client and type definitions                                 |
| `atproto/`     | ATProto utilities and record creation                           |
| `auth/`        | Authentication (OAuth client, session management, auth context) |
| `bluesky/`     | Bluesky integration (post service, types)                       |
| `constants/`   | Application constants (subkind colors, etc.)                    |
| `hooks/`       | React Query hooks for data fetching                             |
| `schemas/`     | Zod validation schemas (eprint, governance)                     |
| `utils/`       | Utility functions (formatting, ATProto helpers)                 |
| `errors.ts`    | Error types and handling                                        |
| `index.ts`     | Barrel export for all modules                                   |
| `utils.ts`     | General utility functions (cn for classnames)                   |

## Key Modules

### API Client (`api/`)

- **`client.ts`** - Typed fetch client using OpenAPI-generated types
- **`query-client.ts`** - React Query client configuration
- **`schema.generated.ts`** - Auto-generated OpenAPI types (DO NOT EDIT)
- **`schema.d.ts`** - Domain type definitions

### Authentication (`auth/`)

- **`oauth-client.ts`** - ATProto OAuth DPOP client
- **`auth-context.tsx`** - React context for auth state
- **`paper-oauth-popup.ts`** - Popup-based OAuth flow for paper claiming
- **`paper-session.ts`** - Session management for paper claiming
- **`storage.ts`** - Token storage utilities
- **`service-auth.ts`** - Service-to-service authentication

### Hooks (`hooks/`)

Data fetching hooks built on React Query:

| Hook                          | Description                              |
| ----------------------------- | ---------------------------------------- |
| `use-eprint.ts`               | Eprint fetching and prefetching          |
| `use-search.ts`               | Full-text search                         |
| `use-faceted-search.ts`       | Faceted search with filters              |
| `use-author.ts`               | Author profiles and metrics              |
| `use-field.ts`                | Knowledge graph field data               |
| `use-trending.ts`             | Trending eprints and tags                |
| `use-review.ts`               | Reviews and inline comments              |
| `use-endorsement.ts`          | Endorsement management                   |
| `use-tags.ts`                 | Tag operations                           |
| `use-claiming.ts`             | Paper claiming workflow                  |
| `use-governance.ts`           | Governance proposals and voting          |
| `use-discovery.ts`            | Recommendations and similar papers       |
| `use-backlinks.ts`            | Backlink data                            |
| `use-notifications.ts`        | User notifications                       |
| `use-activity.ts`             | Activity logging                         |
| `use-nodes.ts`                | Knowledge graph nodes                    |
| `use-edges.ts`                | Knowledge graph edges                    |
| `use-profile-autocomplete.ts` | ORCID, affiliation, keyword autocomplete |
| `use-mention-autocomplete.ts` | @mention autocomplete                    |
| `use-share-to-bluesky.ts`     | Bluesky sharing                          |

### Schemas (`schemas/`)

Zod validation schemas:

- **`eprint.ts`** - Eprint submission and form validation
- **`governance.ts`** - Proposal and vote validation

### Utilities (`utils/`)

- **`atproto.ts`** - ATProto URI parsing and formatting
- **`format-date.ts`** - Date formatting utilities
- **`format-number.ts`** - Number formatting
- **`facets.ts`** - Rich text facet utilities
- **`annotation-serializer.ts`** - PDF annotation serialization

## Usage

Import from the main barrel file or specific modules:

```tsx
// From barrel (recommended for most cases)
import { useEprint, useSearch, apiClient } from '@/lib';

// Direct imports for specific modules
import { useEprint, eprintKeys } from '@/lib/hooks/use-eprint';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
```

## API Type Generation

Frontend types are auto-generated from the backend OpenAPI spec:

```bash
# Start dev server to expose /openapi.json
pnpm dev

# Regenerate types
pnpm openapi:generate
```

This updates `schema.generated.ts`. Never edit this file manually.
