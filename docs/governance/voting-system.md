# Voting system

Chive uses a weighted voting system where expertise in the relevant domain increases vote influence. Specialists have greater say in their fields while community participation is maintained.

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

Weights do not stack. The user's role determines their voting weight.

## Approval threshold

All proposals require **67% weighted approval** with a minimum of **3 votes** to pass.

### Threshold calculation

```text
Approval percentage = (Weighted approve votes) / (Weighted total votes) x 100
```

Example:

```text
Votes:
- 3 community members approve (3 x 1.0 = 3.0)
- 2 domain experts approve (2 x 3.0 = 6.0)
- 1 trusted editor rejects (1 x 2.0 = 2.0)

Weighted approve: 3.0 + 6.0 = 9.0
Weighted total: 3.0 + 6.0 + 2.0 = 11.0
Approval: 9.0 / 11.0 = 81.8%

Result (67% threshold, 6 voters >= 3 minimum): APPROVED
```

:::info Planned
Per-proposal-type thresholds and quorum rules are a design goal. The current implementation uses a single configurable threshold for all proposal types.
:::

## Voting periods

| Phase      | Duration |
| ---------- | -------- |
| Discussion | 7 days   |
| Voting     | 5 days   |

### Timeline example

```text
Day 1:   Proposal submitted
Day 1-7: Discussion period (comments, revisions)
Day 8:   Voting opens
Day 12:  Voting closes
```

## Abstention and recusal

| Action      | When to use                    | Effect                    |
| ----------- | ------------------------------ | ------------------------- |
| **Abstain** | Insufficient knowledge to vote | Not counted in percentage |
| **Recuse**  | Conflict of interest           | Cannot vote; documented   |

Abstentions do not count toward the minimum vote total but do count toward the minimum voter count.

## Vote changes

Voters can change their vote during the voting period:

- Only the final vote counts
- Vote history is recorded for transparency
- Changes after voting closes are not accepted

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

- [Proposals](proposals): How to create and submit proposals
- [Authority control](authority-control): Special rules for authority records
- [Governance overview](overview): The big picture
