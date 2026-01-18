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

Community members elevated for consistent quality contributions:

- Review and approve routine proposals
- Mentor new contributors
- Weighted votes (2.0x standard)

### Domain experts

Users recognized for expertise in specific fields:

- Vote on proposals in their area of expertise
- Provide specialist input on field changes
- Weighted votes (2.5x standard)

### Graph editors

Users responsible for maintaining knowledge graph nodes:

- Manage knowledge graph nodes (fields, facets, authorities)
- Reconcile with external vocabularies (Wikidata, LCSH, VIAF)
- Approve node and edge changes
- Weighted votes (2.0x standard)

### Administrators

Platform administrators with oversight responsibilities:

- Resolve disputes
- Manage the Governance PDS
- Veto power on proposals
- Highest vote weight (5.0x)

## Governance scope

### What is governed

| Area                      | Governance mechanism           |
| ------------------------- | ------------------------------ |
| **Knowledge graph nodes** | Community proposals and voting |
| **Knowledge graph edges** | Community proposals and voting |
| **Facet definitions**     | Proposal with lower threshold  |
| **Content policies**      | Administrator decisions        |
| **Tag promotion**         | Two-stage nomination and vote  |

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

| Role             | Weight multiplier |
| ---------------- | ----------------- |
| Community member | 1.0x              |
| Trusted editor   | 2.0x              |
| Graph editor     | 2.0x              |
| Domain expert    | 2.5x              |
| Administrator    | 5.0x              |

See [Voting system](./voting-system.md) for thresholds and quorum requirements.

## Transparency

All governance actions are public:

- Proposals and voting records are visible to all
- Administrator decisions are logged
- Annual transparency reports detail statistics

## Governance documentation

| Document                                    | Description                        |
| ------------------------------------------- | ---------------------------------- |
| [Voting system](./voting-system.md)         | Thresholds, weights, and quorum    |
| [Proposals](./proposals.md)                 | Types, lifecycle, and requirements |
| [Authority control](./authority-control.md) | Managing authority records         |
| [Governance PDS](./governance-pds.md)       | Technical architecture             |

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
4. Administrator review and approval

## Next steps

- [Voting system](./voting-system.md): Understand how decisions are made
- [Proposals](./proposals.md): Learn how to propose changes
- [Knowledge graph](/concepts/knowledge-graph): Understand what is governed
