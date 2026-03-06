# ATProto granular OAuth scopes

## Overview

ATProto's granular scopes specification allows OAuth clients to request only the permissions they need, rather than broad access to the user's entire repository. Chive uses this to scope access by activity: browsing, submitting eprints, reviewing, or full participation.

Each scope string follows a typed prefix convention:

| Prefix        | Purpose                                         | Example                               |
| ------------- | ----------------------------------------------- | ------------------------------------- |
| `repo:`       | Read/write a specific collection                | `repo:pub.chive.eprint.submission`    |
| `blob:`       | Upload blobs of a given MIME type               | `blob:application/pdf`                |
| `include:`    | Reference a permission set (a bundle of scopes) | `include:pub.chive.auth.authorAccess` |
| `transition:` | Backward compatibility with pre-granular PDSes  | `transition:generic`                  |

The `atproto` base scope is always required and grants baseline protocol access (identity resolution, session management).

## Permission sets

Permission sets bundle multiple granular scopes into a single `include:` reference. Chive defines four tiers in a strict hierarchy: each tier includes all permissions from the tiers below it.

### basicReader

**Scope string:** `include:pub.chive.auth.basicReader`

Grants read-only RPC access. Users can browse eprints, view reviews and endorsements, search the knowledge graph, and view author profiles. No write access to any collection.

### authorAccess

**Scope string:** `include:pub.chive.auth.authorAccess`

Includes basicReader permissions plus the ability to create and manage eprints:

- `repo:pub.chive.eprint.submission` (create/update eprints)
- `repo:pub.chive.eprint.version` (manage versions)
- `repo:pub.chive.eprint.userTag` (add tags)
- `repo:pub.chive.eprint.citation` (curate citations)
- `repo:pub.chive.eprint.relatedWork` (link related works)
- `repo:pub.chive.eprint.changelog` (track changes)
- `repo:pub.chive.actor.profile` (manage profile)
- `repo:pub.chive.actor.profileConfig` (configure profile display)
- `blob:application/pdf` (upload PDF files)
- `blob:image/*` (upload figures)

### reviewerAccess

**Scope string:** `include:pub.chive.auth.reviewerAccess`

Includes authorAccess permissions plus the ability to review, endorse, and annotate:

- `repo:pub.chive.review.comment` (write inline reviews)
- `repo:pub.chive.review.endorsement` (endorse eprints)
- `repo:pub.chive.annotation.comment` (annotate documents)
- `repo:pub.chive.annotation.entityLink` (link entities in annotations)

### fullAccess

**Scope string:** `include:pub.chive.auth.fullAccess`

Includes reviewerAccess permissions plus governance participation:

- `repo:pub.chive.graph.nodeProposal` (propose knowledge graph nodes)
- `repo:pub.chive.graph.edgeProposal` (propose knowledge graph edges)
- `repo:pub.chive.graph.vote` (vote on proposals)
- `repo:pub.chive.graph.node` (create personal graph nodes)
- `repo:pub.chive.graph.edge` (create personal graph edges)

## External namespace scopes

Chive cross-posts to external ATProto namespaces for interoperability. These scopes are outside `pub.chive.*` and must be requested as individual `repo:` scopes alongside the Chive permission sets.

| Scope                                | Purpose                                |
| ------------------------------------ | -------------------------------------- |
| `repo:app.bsky.feed.post`            | Cross-post eprints to Bluesky          |
| `repo:site.standard.document`        | Link eprints in Standard.site protocol |
| `repo:network.cosmik.card`           | Create Cosmik cards for eprints        |
| `repo:network.cosmik.collectionLink` | Link eprints to Cosmik collections     |
| `repo:network.cosmik.collection`     | Create Cosmik collections              |

These are automatically included for `submit`, `review`, and `full` intents (not for `browse`).

## Intent-based login

The frontend maps user actions to permission levels via the `AuthIntent` type. When a user triggers login, the caller specifies an intent, and the OAuth flow requests only the necessary scopes.

```typescript
import { getScopesForIntent, type AuthIntent } from '@/lib/auth/scopes';

// User clicks "Submit Eprint" while not logged in
const scope = getScopesForIntent('submit');
// => "atproto include:pub.chive.auth.authorAccess repo:app.bsky.feed.post repo:site.standard.document ..."

// User clicks "Write Review"
const scope = getScopesForIntent('review');
// => "atproto include:pub.chive.auth.reviewerAccess repo:app.bsky.feed.post ..."
```

### Intent mapping

| Intent   | Permission Set | External Scopes | Use Case                                |
| -------- | -------------- | --------------- | --------------------------------------- |
| `browse` | basicReader    | None            | Save preferences, track reading history |
| `submit` | authorAccess   | All             | Submit or edit an eprint                |
| `review` | reviewerAccess | All             | Write reviews or endorsements           |
| `full`   | fullAccess     | All             | Full participation including governance |

### Adding intent to LoginOptions

Pass the intent when initiating the login flow:

```typescript
import type { LoginOptions } from '@/lib/auth/types';

const options: LoginOptions = {
  handle: 'alice.bsky.social',
  intent: 'submit',
};

await login(options);
```

The `login` function calls `getScopesForIntent(options.intent ?? 'full')` to build the scope string for the OAuth authorization request.

## Backward compatibility

### The transition:generic scope

PDSes that predate the granular scopes specification do not understand `include:` or `repo:` scope strings. For these servers, Chive's client metadata includes `transition:generic`, which grants broad read/write access.

The `CLIENT_METADATA_SCOPE` constant declares the maximum set of scopes the app may request:

```typescript
import { CLIENT_METADATA_SCOPE } from '@/auth/scopes/chive-scopes.js';
// => "atproto transition:generic include:pub.chive.auth.fullAccess repo:app.bsky.feed.post ..."
```

### Scope checking with legacy support

The `hasScope` utility treats `transition:generic` as a superset of all Chive scopes:

```typescript
import { hasScope, LEGACY_SCOPE, PERMISSION_SETS } from '@/lib/auth/scopes';

// User authenticated with a pre-granular PDS
const grantedScopes = ['atproto', 'transition:generic'];

hasScope(grantedScopes, PERMISSION_SETS.FULL_ACCESS);
// => true (transition:generic implies everything)

hasScope(grantedScopes, PERMISSION_SETS.BASIC_READER);
// => true
```

## Service auth and lxm enforcement

When the frontend makes authenticated API calls, it requests a service auth JWT from the user's PDS via `com.atproto.server.getServiceAuth`. This JWT includes an optional `lxm` (lexicon method) claim that restricts the token to a single XRPC method.

### How it works

1. Frontend determines the XRPC method to call (e.g., `pub.chive.sync.indexRecord`)
2. Frontend requests a service auth JWT with `aud: "did:web:chive.pub"` and `lxm: "pub.chive.sync.indexRecord"`
3. The user's PDS checks that the granted OAuth scopes cover the requested `lxm`
4. PDS issues a JWT signed with the user's signing key
5. Chive verifies the JWT signature against the user's DID document
6. Chive checks that the `lxm` claim matches the XRPC endpoint being called

### Token flow

```text
Frontend                    User's PDS                 Chive Backend
   |                           |                           |
   |-- getServiceAuth(aud,lxm) |                           |
   |                           |-- check OAuth scopes      |
   |                           |-- sign JWT                |
   |<-- JWT {iss,aud,lxm,exp}  |                           |
   |                           |                           |
   |-- PUT /xrpc/method  Authorization: Bearer <JWT>  ---->|
   |                           |                           |-- verify signature
   |                           |                           |-- check lxm match
   |                           |                           |-- process request
```

## Frontend scope utilities

### Checking scopes in components

Use `hasScope` to conditionally render UI elements based on the user's granted permissions:

```typescript
import { hasScope, PERMISSION_SETS } from '@/lib/auth/scopes';
import { useAuth } from '@/lib/auth';

function SubmitButton() {
  const { session } = useAuth();
  const canSubmit = session
    ? hasScope(session.scope, PERMISSION_SETS.AUTHOR_ACCESS)
    : false;

  if (!canSubmit) {
    return <ScopeUpgradePrompt requiredIntent="submit" />;
  }

  return <button>Submit Eprint</button>;
}
```

### ScopeUpgradePrompt

When a user's current scopes are insufficient for an action, display a `ScopeUpgradePrompt` that explains the required permissions and offers to re-authenticate with the appropriate intent:

```tsx
<ScopeUpgradePrompt
  requiredIntent="review"
  message="Writing reviews requires additional permissions."
/>
```

The component calls `login({ intent: requiredIntent })` to initiate a new OAuth flow with upgraded scopes. The PDS merges the new grants with existing ones.

### useHasScope Hook

For components that need reactive scope checking:

```typescript
import { useHasScope } from '@/lib/auth/auth-context';
import { PERMISSION_SETS } from '@/lib/auth/scopes';

function ReviewPanel() {
  const canReview = useHasScope(PERMISSION_SETS.REVIEWER_ACCESS);

  // canReview updates automatically when session changes
  if (!canReview) return null;

  return <ReviewForm />;
}
```

## Backend scope constants

The backend mirrors the frontend scope constants for validation:

```typescript
import {
  REPO_SCOPES,
  EXTERNAL_REPO_SCOPES,
  BLOB_SCOPES,
  PERMISSION_SETS,
  LEGACY_SCOPE,
  buildScopeString,
  CLIENT_METADATA_SCOPE,
  CHIVE_SERVICE_DID,
} from '@/auth/scopes/chive-scopes.js';

// Chive repo scopes (17 collections)
REPO_SCOPES.EPRINT_SUBMISSION; // "repo:pub.chive.eprint.submission"
REPO_SCOPES.REVIEW_COMMENT; // "repo:pub.chive.review.comment"
REPO_SCOPES.GRAPH_VOTE; // "repo:pub.chive.graph.vote"

// External repo scopes (5 cross-posting targets)
EXTERNAL_REPO_SCOPES.BLUESKY_POST; // "repo:app.bsky.feed.post"
EXTERNAL_REPO_SCOPES.STANDARD_DOCUMENT; // "repo:site.standard.document"
EXTERNAL_REPO_SCOPES.COSMIK_CARD; // "repo:network.cosmik.card"

// Build a custom scope string (always includes "atproto")
buildScopeString([LEGACY_SCOPE, PERMISSION_SETS.AUTHOR_ACCESS]);
// => "atproto transition:generic include:pub.chive.auth.authorAccess"

// Service DID for JWT audience verification
CHIVE_SERVICE_DID; // "did:web:chive.pub"
```

## Testing

### Running scope tests

```bash
# Backend scope tests
pnpm vitest run tests/unit/auth/scopes/chive-scopes.test.ts

# Frontend scope tests
cd web && pnpm vitest run tests/unit/auth/scopes.test.ts
```

### What the tests cover

- All scope strings use correct prefixes (`repo:`, `blob:`, `include:`)
- All Chive scopes are within the `pub.chive.*` namespace
- External scopes are NOT in the `pub.chive.*` namespace
- `buildScopeString` always includes `atproto` and deduplicates entries
- `CLIENT_METADATA_SCOPE` contains Chive permission sets and external scopes
- `getScopesForIntent` maps each intent to the correct permission set
- Write intents (submit, review, full) include external cross-posting scopes
- Browse intent does not include external scopes
- `hasScope` respects the permission hierarchy (fullAccess satisfies basicReader)
- `hasScope` treats `transition:generic` as a universal grant
- `hasScope` does not grant higher scopes from lower ones
