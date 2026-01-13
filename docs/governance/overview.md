# Governance overview

Chive uses a Wikipedia-style moderation model where the research community collaboratively manages the knowledge graph, authority records, and content policies. This decentralized approach ensures that no single entity controls the classification of scholarly work.

## Governance philosophy

Chive's governance rests on three pillars:

| Pillar                 | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| **Community-driven**   | Researchers propose and vote on changes                        |
| **Expertise-weighted** | Domain experts have greater influence in their fields          |
| **ATProto-native**     | Governance data lives in a dedicated PDS, ensuring portability |

## Key roles

### Community members

Any authenticated user can:

- Propose new fields or changes to the knowledge graph
- Vote on pending proposals
- Tag eprints with user-generated tags
- Report content policy violations

### Trusted editors

Appointed community members with demonstrated expertise:

- Review and approve routine proposals
- Moderate content and enforce policies
- Mentor new contributors
- Weighted votes (3.5x standard)

### Authority editors

Library science professionals (MLIS or equivalent) who:

- Manage authority records
- Reconcile with external vocabularies (Wikidata, LCSH, VIAF)
- Approve authority record changes
- Highest vote weight (4.5x standard)

### Governance committee

Elected body that:

- Sets overall policy direction
- Resolves disputes
- Appoints trusted and authority editors
- Manages the Governance PDS

## Governance scope

### What is governed

| Area                       | Governance mechanism           |
| -------------------------- | ------------------------------ |
| **Knowledge graph fields** | Community proposals and voting |
| **Authority records**      | Authority editor approval      |
| **Facet definitions**      | Proposal with lower threshold  |
| **Content policies**       | Governance committee decisions |
| **Tag promotion**          | Two-stage nomination and vote  |

### What is not governed

| Area                | Rationale                                     |
| ------------------- | --------------------------------------------- |
| **User content**    | Lives in user PDSes; users control their data |
| **Eprint metadata** | Entered by authors; Chive only indexes        |
| **Personal tags**   | User-generated; no approval needed            |
| **User identity**   | Managed by AT Protocol DIDs                   |

## The Governance PDS

All governance data lives in a dedicated Personal Data Server:

```
did:plc:chive-governance
```

This PDS stores:

- Authority records
- Facet definitions
- Organizational records
- Reconciliation history
- Approved proposals

By storing governance data in a PDS, it remains:

- Portable (can move to different hosts)
- Verifiable (cryptographically signed)
- ATProto-native (indexed by any compliant AppView)

## Proposal lifecycle

```
┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌───────────┐
│  Draft   │────►│  Discussion │────►│  Voting  │────►│  Outcome  │
│          │     │  (7 days)   │     │ (5 days) │     │           │
└──────────┘     └─────────────┘     └──────────┘     └───────────┘
```

1. **Draft**: Proposer creates and refines the proposal
2. **Discussion**: Community comments and suggests changes
3. **Voting**: Weighted votes tallied against thresholds
4. **Outcome**: Approved proposals are enacted; rejected ones archived

See [Proposals](./proposals.md) for details.

## Voting system

Not all votes are equal. Vote weight depends on:

| Factor                                   | Weight multiplier |
| ---------------------------------------- | ----------------- |
| Base (any authenticated user)            | 1.0x              |
| Active contributor (10+ eprints/reviews) | 1.5x              |
| Domain expert (publications in field)    | 2.5x              |
| Trusted editor                           | 3.5x              |
| Authority editor                         | 4.5x              |

See [Voting system](./voting-system.md) for thresholds and quorum requirements.

## Content moderation

Chive enforces community standards through:

1. **User reports**: Anyone can flag policy violations
2. **Trusted editor review**: Editors assess reports
3. **Action**: Warnings, content hiding, or escalation
4. **Appeals**: 14-day window for disputed decisions

See [Moderation](./moderation.md) for policies and procedures.

## Transparency

All governance actions are public:

- Proposals and voting records are visible to all
- Moderation decisions are logged (with privacy protections)
- Governance committee meeting summaries are published
- Annual transparency reports detail statistics

## Governance documentation

| Document                                    | Description                        |
| ------------------------------------------- | ---------------------------------- |
| [Voting system](./voting-system.md)         | Thresholds, weights, and quorum    |
| [Proposals](./proposals.md)                 | Types, lifecycle, and requirements |
| [Authority control](./authority-control.md) | Managing authority records         |
| [Moderation](./moderation.md)               | Content policies and enforcement   |
| [Governance PDS](./governance-pds.md)       | Technical architecture             |
| [Organization](./organization.md)           | Non-profit structure and funding   |

## Getting involved

### Propose a change

1. Draft your proposal with clear rationale
2. Submit via the governance interface
3. Respond to community feedback during discussion
4. Await voting outcome

### Become a trusted editor

1. Contribute actively (eprints, reviews, tags)
2. Demonstrate expertise in your field
3. Apply or be nominated
4. Governance committee review

### Join the governance committee

1. Be an active trusted editor for 6+ months
2. Participate in governance discussions
3. Stand for election (annual cycle)
4. Serve 2-year terms

## Next steps

- [Voting system](./voting-system.md): Understand how decisions are made
- [Proposals](./proposals.md): Learn how to propose changes
- [Knowledge graph](/concepts/knowledge-graph): Understand what is governed
