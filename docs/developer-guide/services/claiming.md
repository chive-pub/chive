# ClaimingService

The ClaimingService enables authors to claim ownership of papers by creating records in their Personal Data Server (PDS). Unlike traditional verification systems, Chive does not gatekeep who can claim a paper; anyone can write whatever they want to their own PDS. The system focuses on making it easy to claim papers, not hard.

## Philosophy

**Core principle:** No verification gatekeeping. Users control their own data.

**Two distinct claim types:**

1. **External claims** (from arXiv, Semantic Scholar, etc.): Works like submitting a new eprint, but with prefilled data from the external source
2. **Co-author claims** (on existing PDS records): A request/approval flow where the PDS owner decides whether to add the claimant as co-author

## External claims

External claims work by prefilling the submission wizard with data from external sources. The user then creates a record in their own PDS.

### Usage

```typescript
import { ClaimingService } from '@/services/claiming';

const claiming = container.resolve(ClaimingService);

// Get submission data prefilled from external source
const prefilled = await claiming.getSubmissionData('arxiv', '2401.12345');

// Returns form data ready for the submission wizard:
// {
//   title: 'Paper Title',
//   abstract: 'Abstract text...',
//   authors: [{ name: 'Author Name', orcid: '...' }],
//   keywords: ['keyword1', 'keyword2'],
//   doi: '10.1234/example',
//   externalIds: { arxiv: '2401.12345' }
// }

// User then completes the submission wizard and creates the record
// in their own PDS (handled by the frontend)
```

### Search with duplicate detection

When searching for papers to claim, the service checks if papers already exist on Chive:

```typescript
const results = await claiming.searchEprints({
  query: 'natural language processing',
  sources: ['arxiv', 'semanticscholar'],
  limit: 20,
});

// Results include existing Chive URIs if the paper is already claimed
for (const eprint of results.eprints) {
  if (eprint.existingChiveUri) {
    // Paper already on Chive - offer co-author claim instead
    console.log(`Already on Chive: ${eprint.existingChiveUri}`);
  }
}
```

## Co-author claims

Co-author claims allow users to request being added to papers already in another user's PDS. The PDS owner must approve the request.

### Requesting co-authorship

```typescript
// User requests to be added as co-author
const request = await claiming.requestCoauthorship(
  'at://did:plc:owner/pub.chive.eprint.submission/abc123', // eprint URI
  'did:plc:claimant', // claimant DID
  'Jane Smith', // claimant display name
  1, // author index they're claiming (0-based)
  'J. Smith', // name as it appears on the paper
  'I am the second author on this paper' // optional message
);
```

### Viewing requests (PDS owner)

```typescript
// PDS owner gets pending requests for their papers
const requests = await claiming.getCoauthorRequestsForOwner('did:plc:owner');

for (const req of requests) {
  console.log(`${req.claimantName} wants to be added as ${req.authorName}`);
}
```

### Approving/rejecting requests

```typescript
// Approve a request
await claiming.approveCoauthorRequest(requestId, 'did:plc:owner');

// Reject a request
await claiming.rejectCoauthorRequest(
  requestId,
  'did:plc:owner',
  'Cannot verify you are this author'
);
```

### Data sovereignty

When a co-author request is approved:

1. Chive stores the approval status in its database
2. The PDS owner's client receives notification
3. **The owner's client updates their PDS record** (Chive never writes to user PDSes)
4. The firehose propagates the update
5. Chive re-indexes the updated record

This respects AT Protocol's data sovereignty principle: users control their own PDS writes.

## Claim states

```typescript
type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'expired';

type CoauthorClaimStatus = 'pending' | 'approved' | 'rejected';
```

## Database schema

### External claims

External claims are tracked in the `claim_requests` table:

| Column           | Type        | Description                       |
| ---------------- | ----------- | --------------------------------- |
| id               | bigserial   | Primary key                       |
| import_id        | bigint      | Reference to imported eprint      |
| claimant_did     | text        | DID of the claimant               |
| status           | text        | pending/approved/rejected/expired |
| canonical_uri    | text        | AT-URI once record created        |
| rejection_reason | text        | Reason if rejected                |
| reviewed_by_did  | text        | Admin who reviewed                |
| reviewed_at      | timestamptz | When reviewed                     |
| created_at       | timestamptz | When request created              |
| expires_at       | timestamptz | Expiration time                   |

### Co-author claims

Co-author claims are tracked in the `coauthor_claim_requests` table:

| Column           | Type        | Description                     |
| ---------------- | ----------- | ------------------------------- |
| id               | bigserial   | Primary key                     |
| eprint_uri       | text        | AT-URI of the eprint            |
| eprint_owner_did | text        | DID of the PDS owner            |
| claimant_did     | text        | DID of the claimant             |
| claimant_name    | text        | Display name at time of request |
| author_index     | integer     | Index of author being claimed   |
| author_name      | text        | Name of author being claimed    |
| status           | text        | pending/approved/rejected       |
| message          | text        | Optional message from claimant  |
| rejection_reason | text        | Reason if rejected              |
| created_at       | timestamptz | When request created            |
| reviewed_at      | timestamptz | When reviewed                   |

## Multi-signal matching

The `getSuggestedPapers` method finds papers a user likely authored by combining multiple scoring signals. Each paper is scored by `scorePaperMatch`, which produces a value from 0 to 100. Papers scoring below 10 are excluded from results.

### Scoring signals

| Signal                                        | Points                | Method                          |
| --------------------------------------------- | --------------------- | ------------------------------- |
| ORCID exact match                             | 50                    | Identity verification           |
| External ID match (S2/OpenAlex author)        | 40                    | Identity verification           |
| Exact name token match                        | 30                    | `calculateTokenNameMatch`       |
| Partial name match (2+ tokens, 50%+ coverage) | 15                    | `calculateTokenNameMatch`       |
| Single name token match                       | 5                     | `calculateTokenNameMatch`       |
| OpenAlex topic overlap (subfield match)       | 15                    | `getPaperTopicOverlap`          |
| Keyword matches                               | min(matches \* 3, 10) | User keywords vs title/abstract |
| Inferred field match                          | 5                     | Claimed paper topic inference   |
| Affiliation match                             | 10                    | Network context                 |
| Co-author overlap                             | 10                    | Network context                 |

### Author count penalty

Name match scores are scaled down for papers with many authors:

| Author count | Multiplier |
| ------------ | ---------- |
| 1-10         | 1.0x       |
| 11-50        | 0.5x       |
| 51-200       | 0.2x       |
| 200+         | 0.05x      |

### Content gate

If the combined identity and name score is below 40, and there is zero content overlap (topic, keyword, or field), the final score is capped at 5. This suppresses name-only matches in unrelated fields.

### Helper methods

```typescript
/**
 * Compares user name tokens against a paper author name.
 *
 * Splits both names on whitespace, filters tokens shorter than 2 characters,
 * and checks for exact token overlap.
 *
 * @param userName - the user's display name or name variant
 * @param paperAuthorName - author name as it appears on the paper
 * @returns score and match classification
 */
private calculateTokenNameMatch(
  userName: string,
  paperAuthorName: string
): {
  score: number;
  matchType: 'exact' | 'partial' | 'single' | 'none';
}

/**
 * Aggregates topics, concepts, keywords, and co-author names from
 * the user's approved claims.
 *
 * Queries `claim_requests` joined with `eprint_enrichment` and
 * `eprints_index` to build a content profile for scoring.
 *
 * @param userDid - DID of the user
 * @returns aggregated topic data, or empty arrays if no claims exist
 */
private async getUserClaimedTopics(userDid: string): Promise<{
  concepts: string[];
  topics: string[];
  keywords: string[];
  coauthorNames: string[];
}>
```

### Usage

```typescript
const suggestions = await claimingService.getSuggestedPapers(userDid, {
  limit: 20,
});

for (const paper of suggestions.papers) {
  console.log(`${paper.title} (score: ${paper.matchScore}, reason: ${paper.matchReason})`);
}
```

## Chive-internal suggestions

The `searchInternalPapers` method queries the `eprints_index` table for papers that match the user's name variants in the `authors` JSONB array. These results represent papers already on Chive that the user has not yet claimed.

### How it works

1. Builds `ILIKE ANY` patterns from the user's name variants for case-insensitive matching
2. Excludes papers where the user's DID already appears in the authors array
3. Scores results using the same multi-signal `scorePaperMatch` as external results
4. Deduplicates against external results by DOI (Chive results take priority)
5. Marks each result with `source: 'chive'` and includes a `chiveUri` field

### Query structure

```sql
SELECT e.uri, e.title, e.abstract, e.keywords, e.authors,
       e.published_version->>'doi' AS doi, e.created_at
FROM eprints_index e
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(e.authors) a
  WHERE a->>'name' ILIKE ANY($1)
)
AND NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(e.authors) a
  WHERE a->>'did' = $2
)
ORDER BY e.created_at DESC
LIMIT $3
```

### Usage

Internal results are merged into `getSuggestedPapers` automatically. Callers do not invoke `searchInternalPapers` directly; it runs concurrently with external source searches and its results appear in the same sorted output.

## Dismiss suggestions

Users can dismiss paper suggestions so they do not reappear. Dismissed papers are filtered out in `getSuggestedPapers` before results are returned.

### Database

The `dismissed_suggestions` table stores per-user dismissals:

```sql
CREATE TABLE dismissed_suggestions (
  id SERIAL PRIMARY KEY,
  user_did TEXT NOT NULL,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_did, source, external_id)
);
```

### Methods

```typescript
/**
 * Records a dismissed suggestion. Uses ON CONFLICT DO NOTHING
 * so duplicate dismissals are idempotent.
 *
 * @param userDid - DID of the user dismissing the suggestion
 * @param source - external source of the paper (e.g., 'arxiv', 'chive')
 * @param externalId - source-specific identifier of the paper
 */
async dismissSuggestion(userDid: string, source: string, externalId: string): Promise<void>

/**
 * Loads all dismissed suggestion keys for a user as a Set of
 * composite keys in the form 'source:externalId'.
 *
 * @param userDid - DID of the user
 * @returns set of dismissed composite keys
 */
private async getDismissedSuggestions(userDid: string): Promise<Set<string>>
```

### Usage

```typescript
// dismiss a suggestion
await claimingService.dismissSuggestion(userDid, 'arxiv', '2401.12345');

// subsequent calls to getSuggestedPapers will exclude this paper
const suggestions = await claimingService.getSuggestedPapers(userDid);
```

## Error tracking

The `searchAllSources` method tracks per-source errors so the frontend can display partial-failure warnings instead of silently dropping results.

### Return type

```typescript
interface SourceError {
  /** Source identifier that failed (e.g., 'arxiv', 'openreview'). */
  readonly source: string;
  /** Human-readable error message. */
  readonly message: string;
}

interface SearchAllSourcesResult {
  /** Eprints that were successfully retrieved. */
  readonly results: readonly ExternalEprintWithSource[];
  /** Errors from sources that failed to respond. */
  readonly sourceErrors: readonly SourceError[];
}
```

### Behavior

- Each plugin search runs in parallel with a configurable timeout (default 10 seconds)
- If a plugin throws or times out, its error is captured in `sourceErrors` and the remaining sources continue
- Local import search failures are also captured with `source: 'local'`
- The `sourceErrors` array is passed through the API response so the frontend can display per-source warnings (e.g., "arXiv search unavailable")

### Usage

```typescript
const { results, sourceErrors } = await claimingService.searchAllSources({
  query: 'attention mechanisms',
  author: 'Vaswani',
  limit: 20,
});

// display results from sources that succeeded
for (const eprint of results) {
  console.log(`[${eprint.source}] ${eprint.title}`);
}

// warn about sources that failed
for (const error of sourceErrors) {
  console.warn(`${error.source}: ${error.message}`);
}
```

## AT Protocol compliance

The claiming service follows AT Protocol principles:

- **Never writes to user PDSes**: Chive only reads and indexes
- **All user data in PDSes**: Claim records are created by users in their PDSes
- **Indexes are rebuildable**: Claim metadata can be reconstructed from firehose
- **No gatekeeping**: Anyone can create any record in their PDS

## Next steps

- [Discovery service](./discovery.md): Recommendations and paper suggestions
- [Indexing service](./indexing.md): Firehose indexing pipeline
- [Collections service](./collections.md): How claimed papers relate to user collections
