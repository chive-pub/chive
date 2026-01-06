# ClaimingService

The ClaimingService enables authors to claim ownership of imported preprints through multi-authority verification. It collects evidence from ORCID, Semantic Scholar, OpenReview, OpenAlex, and other sources to verify authorship.

## Claim workflow

```
1. User finds claimable preprint (imported from arXiv, etc.)
2. User initiates claim with optional evidence
3. System collects evidence from multiple authorities
4. System computes confidence score
5. User completes claim (links to ATProto record)
6. Admin reviews (if score below threshold)
7. Claim approved or rejected
```

## Usage

```typescript
import { ClaimingService } from '@/services/claiming';

const claiming = container.resolve(ClaimingService);

// Find claimable preprints for user
const claimable = await claiming.findClaimable({
  claimantDid: userDid,
  sources: ['arxiv', 'semantic-scholar', 'openreview'],
  limit: 20,
});

// Start a claim
const claim = await claiming.startClaim(importId, userDid, {
  orcid: '0000-0002-1825-0097',
  email: 'researcher@university.edu',
});

// Collect evidence from authorities
await claiming.collectEvidence(claim.id);

// Complete the claim
await claiming.completeClaim(claim.id, canonicalUri);
```

## Evidence collection

The service collects evidence from multiple authorities:

### Evidence sources

| Source              | Weight | Evidence type              |
| ------------------- | ------ | -------------------------- |
| ORCID               | 1.0    | Profile lists the paper    |
| Semantic Scholar    | 0.8    | Author ID matches          |
| OpenReview          | 0.8    | Verified author profile    |
| OpenAlex            | 0.7    | Author disambiguation      |
| arXiv               | 0.6    | Submitter metadata         |
| Institutional email | 0.6    | Domain matches affiliation |
| ROR                 | 0.5    | Institution verification   |
| Name matching       | 0.3    | Fuzzy name match           |
| Co-author overlap   | 0.4    | Shared co-authors          |

### Evidence collection

```typescript
async collectEvidence(claimId: string): Promise<Evidence[]> {
  const claim = await this.getClaim(claimId);
  const evidence: Evidence[] = [];

  // ORCID verification
  if (claim.orcid) {
    const orcidPlugin = this.pluginManager?.getPlugin('orcid');
    if (orcidPlugin) {
      const profile = await orcidPlugin.fetchOrcidProfile(claim.orcid);
      const hasWork = profile.works.some(w =>
        w.doi === claim.preprint.doi ||
        w.arxivId === claim.preprint.arxivId
      );
      if (hasWork) {
        evidence.push({
          source: 'orcid',
          weight: 1.0,
          verified: true,
          details: { orcidId: claim.orcid }
        });
      }
    }
  }

  // Semantic Scholar author matching
  const s2Plugin = this.pluginManager?.getPlugin('semantic-scholar');
  if (s2Plugin) {
    const authors = await s2Plugin.searchAuthors(claim.claimantName);
    const match = authors.find(a =>
      a.papers.some(p => p.doi === claim.preprint.doi)
    );
    if (match) {
      evidence.push({
        source: 'semantic-scholar',
        weight: 0.8,
        verified: true,
        details: { authorId: match.authorId }
      });
    }
  }

  // Continue with other sources...
  return evidence;
}
```

## Confidence scoring

The service computes a confidence score from evidence:

```typescript
function computeScore(evidence: Evidence[]): number {
  // Sum weighted evidence
  let score = 0;
  let maxPossible = 0;

  for (const e of evidence) {
    if (e.verified) {
      score += e.weight;
    }
    maxPossible += e.weight;
  }

  // Normalize to 0-100
  return Math.round((score / maxPossible) * 100);
}
```

### Score thresholds

| Score  | Action                     |
| ------ | -------------------------- |
| 80-100 | Auto-approve               |
| 50-79  | Approve with review        |
| 30-49  | Manual review required     |
| 0-29   | Additional evidence needed |

## Claim states

```typescript
type ClaimStatus =
  | 'pending' // Claim initiated
  | 'collecting' // Collecting evidence
  | 'ready' // Evidence collected, awaiting completion
  | 'submitted' // User completed claim
  | 'reviewing' // Under admin review
  | 'approved' // Claim approved
  | 'rejected'; // Claim rejected
```

## Paper suggestions

The service suggests papers for users to claim:

```typescript
async getSuggestedPapers(
  claimantDid: string,
  options: SuggestionOptions
): Promise<SuggestedPaper[]> {
  const profile = await this.getClaimantProfile(claimantDid);

  // Search using profile data
  const suggestions: SuggestedPaper[] = [];

  // By ORCID works
  if (profile.orcid) {
    const orcidPapers = await this.searchByOrcid(profile.orcid);
    suggestions.push(...orcidPapers);
  }

  // By name variations
  const namePapers = await this.searchByName(profile.nameVariants);
  suggestions.push(...namePapers);

  // By affiliation
  if (profile.affiliations) {
    const affiliationPapers = await this.searchByAffiliation(
      profile.nameVariants,
      profile.affiliations
    );
    suggestions.push(...affiliationPapers);
  }

  // Dedupe and rank by confidence
  return this.rankSuggestions(suggestions, options.limit);
}
```

## Admin operations

Administrators can review and manage claims:

```typescript
// Get pending claims for review
const pending = await claiming.getPendingClaims({
  minScore: 30,
  maxScore: 79,
  sortBy: 'score',
  limit: 50,
});

// Approve a claim
await claiming.approveClaim(claimId, reviewerDid);

// Reject a claim
await claiming.rejectClaim(claimId, 'Insufficient evidence', reviewerDid);
```

## Profile data sources

The service uses profile data from multiple sources:

```typescript
interface ClaimantProfile {
  did: string;
  displayName: string;
  nameVariants: string[]; // Name variations for matching
  orcid?: string; // Linked ORCID
  affiliations?: string[]; // Current/past affiliations
  researchInterests?: string[];
  externalIds: {
    semanticScholarId?: string;
    openAlexId?: string;
    openReviewId?: string;
  };
}
```

Profile data comes from:

- Bluesky profile (displayName)
- Chive academic profile (ORCID, affiliations, interests)
- Discovery from external sources (Semantic Scholar, OpenAlex)

## External search

The service searches external sources for claimable papers:

```typescript
// Search all sources
const results = await claiming.searchAllSources({
  query: 'quantum computing',
  author: 'Smith, John',
  limit: 50,
});

// Fast autocomplete
const suggestions = await claiming.autocompleteExternal('neural net', {
  sources: ['arxiv', 'semantic-scholar'],
  limit: 10,
});
```

## Dependencies

```typescript
interface ClaimingDependencies {
  logger: ILogger;
  database: IDatabasePool;
  importService: IImportService;
  identityResolver: IIdentityResolver;
  pluginManager?: IPluginManager; // For external verification
}
```

## Configuration

| Variable                          | Default | Description                      |
| --------------------------------- | ------- | -------------------------------- |
| `CLAIMING_AUTO_APPROVE_THRESHOLD` | `80`    | Score for auto-approval          |
| `CLAIMING_REVIEW_THRESHOLD`       | `50`    | Score for approval with review   |
| `CLAIMING_MANUAL_THRESHOLD`       | `30`    | Score requiring manual review    |
| `CLAIMING_EVIDENCE_TIMEOUT`       | `60000` | Evidence collection timeout (ms) |
