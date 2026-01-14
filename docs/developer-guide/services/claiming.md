# ClaimingService

The ClaimingService enables authors to claim ownership of papers by creating records in their Personal Data Server (PDS). Unlike traditional verification systems, Chive does not gatekeep who can claim a paper—anyone can write whatever they want to their own PDS. The system focuses on making it easy to claim papers, not hard.

## Philosophy

**Core principle:** No verification gatekeeping. Users control their own data.

**Two distinct claim types:**

1. **External claims** (from arXiv, Semantic Scholar, etc.): Works like submitting a new eprint, but with prefilled data from the external source
2. **Co-author claims** (on existing PDS records): A request/approval flow where the PDS owner decides whether to add the claimant as co-author

## External Claims

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

### Search with Duplicate Detection

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

## Co-Author Claims

Co-author claims allow users to request being added to papers already in another user's PDS. The PDS owner must approve the request.

### Requesting Co-Authorship

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

### Viewing Requests (PDS Owner)

```typescript
// PDS owner gets pending requests for their papers
const requests = await claiming.getCoauthorRequestsForOwner('did:plc:owner');

for (const req of requests) {
  console.log(`${req.claimantName} wants to be added as ${req.authorName}`);
}
```

### Approving/Rejecting Requests

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

### Data Sovereignty

When a co-author request is approved:

1. Chive stores the approval status in its database
2. The PDS owner's client receives notification
3. **The owner's client updates their PDS record** (Chive never writes to user PDSes)
4. The firehose propagates the update
5. Chive re-indexes the updated record

This respects ATProto's data sovereignty principle—users control their own PDS writes.

## Claim States

```typescript
type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'expired';

type CoauthorClaimStatus = 'pending' | 'approved' | 'rejected';
```

## Database Schema

### External Claims

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

### Co-Author Claims

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

## ATProto Compliance

The claiming service follows ATProto principles:

- **Never writes to user PDSes** - Chive only reads and indexes
- **All user data in PDSes** - Claim records are created by users in their PDSes
- **Indexes are rebuildable** - Claim metadata can be reconstructed from firehose
- **No gatekeeping** - Anyone can create any record in their PDS

## See Also

- [Discovery Service](./discovery.md): Recommendations and suggestions
- [Indexing Service](./indexing.md): Firehose indexing pipeline
