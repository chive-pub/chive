# Voting system

Chive uses a weighted voting system where expertise in the relevant domain increases vote influence. This ensures that specialists have greater say in their fields while maintaining community participation.

## Voter tiers

| Tier             | Weight | Description                                        |
| ---------------- | ------ | -------------------------------------------------- |
| Community member | 1.0x   | Any authenticated user                             |
| Trusted editor   | 2.0x   | Elevated role for consistent quality contributions |
| Graph editor     | 3.0x   | Can modify knowledge graph nodes and edges         |
| Domain expert    | 3.0x   | Recognized expertise in the proposal's field       |
| Administrator    | 5.0x   | Platform administrators with veto power            |

### How weight is determined

Voting weight is based on the user's assigned role. The highest applicable role weight is used:

```typescript
const ROLE_VOTE_WEIGHTS: Record<GovernanceRole, number> = {
  'community-member': 1.0,
  'trusted-editor': 2.0,
  'graph-editor': 3.0,
  'domain-expert': 3.0,
  administrator: 5.0,
};
```

Note: Weights do not stack. The user's role determines their voting weight.

## Approval thresholds

Different proposal types require different levels of consensus:

| Proposal type    | Approval threshold | Minimum votes | Expert votes required |
| ---------------- | ------------------ | ------------- | --------------------- |
| Create field     | 67%                | 5             | 3                     |
| Update field     | 60%                | 3             | 2                     |
| Merge fields     | 67%                | 5             | 3                     |
| Deprecate field  | 75%                | 7             | 4                     |
| Facet proposal   | 60%                | 3             | 2                     |
| Authority change | 75%                | 7             | 5                     |
| Tag promotion    | 60%                | 3             | 2                     |

### Threshold calculation

```
Approval percentage = (Weighted approve votes) / (Weighted total votes) × 100
```

Example:

```
Votes:
- 3 community members approve (3 × 1.0 = 3.0)
- 2 domain experts approve (2 × 3.0 = 6.0)
- 1 trusted editor rejects (1 × 2.0 = 2.0)

Weighted approve: 3.0 + 6.0 = 9.0
Weighted total: 3.0 + 6.0 + 2.0 = 11.0
Approval: 9.0 / 11.0 = 81.8%

For a "Create field" proposal (67% threshold): APPROVED
```

## Quorum requirements

Proposals require minimum participation before voting closes:

| Proposal type     | Minimum voters | Minimum weighted votes |
| ----------------- | -------------- | ---------------------- |
| Field proposals   | 5              | 8.0                    |
| Facet proposals   | 3              | 5.0                    |
| Authority changes | 7              | 15.0                   |
| Tag promotion     | 3              | 4.0                    |

If quorum is not met, the voting period extends by 3 days (up to 2 extensions).

## Expert vote requirements

Some proposals require endorsement from domain experts:

```
Expert vote = Vote from user with publications in the proposal's field
            OR trusted/graph editor with relevant expertise
```

This prevents:

- Gaming by coordinated low-expertise voters
- Fields being created without specialist input
- Authority records changing without librarian review

## Voting periods

| Phase                     | Duration            |
| ------------------------- | ------------------- |
| Discussion                | 7 days              |
| Voting                    | 5 days              |
| Extensions (if no quorum) | 3 days each (max 2) |

### Timeline example

```
Day 1:  Proposal submitted
Day 1-7: Discussion period (comments, revisions)
Day 8:  Voting opens
Day 12: Voting closes (if quorum met)
        OR
Day 12: First extension begins
Day 15: Voting closes (if quorum met)
        OR
Day 15: Second extension begins
Day 18: Voting closes (final, regardless of quorum)
```

## Consensus detection

For non-contentious changes, early consensus can shorten the voting period:

```
Early consensus criteria:
- 80%+ weighted approval
- Quorum exceeded by 50%
- No expert votes against
- Minimum 48 hours elapsed
```

If all criteria are met, the proposal is approved immediately.

## Abstention and recusal

| Action      | When to use                    | Effect                    |
| ----------- | ------------------------------ | ------------------------- |
| **Abstain** | Insufficient knowledge to vote | Not counted in percentage |
| **Recuse**  | Conflict of interest           | Cannot vote; documented   |

Abstentions do not count toward quorum weighted votes but do count toward minimum voters.

## Vote changes

Voters can change their vote during the voting period:

- Only the final vote counts
- Vote history is recorded for transparency
- Changes after voting closes are not accepted

## Tie breaking

If weighted votes are exactly tied:

1. Extend voting by 48 hours
2. If still tied, status quo prevails (proposal rejected)
3. Proposer may revise and resubmit

## Special voting rules

### Controversial proposals

Proposals flagged as controversial (10+ comments with opposing views) receive:

- Extended discussion period (14 days instead of 7)
- Higher threshold (+10% to base threshold)
- Administrator review required

### Emergency proposals

For urgent security or legal issues:

- 24-hour expedited voting
- Administrator approval required
- Must still meet thresholds
- Documented justification required

### Procedural votes

Meta-governance changes (changing thresholds, adding tiers) require:

- 80% approval threshold
- 10+ minimum votes
- Administrator endorsement
- 30-day implementation delay

## Transparency

All voting data is public:

```json
{
  "proposalId": "proposal-123",
  "votes": [
    {
      "voter": "did:plc:voter1...",
      "vote": "approve",
      "weight": 3.0,
      "tier": "domain_expert",
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ],
  "summary": {
    "approve": 8,
    "reject": 2,
    "abstain": 1,
    "weightedApprove": 18.5,
    "weightedReject": 4.0,
    "approvalPercentage": 82.2
  }
}
```

## Next steps

- [Proposals](./proposals.md): How to create and submit proposals
- [Authority control](./authority-control.md): Special rules for authority records
- [Governance overview](./overview.md): The big picture
