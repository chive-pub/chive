# Moderation

Chive maintains community standards through a transparent moderation system. This document covers content policies, enforcement procedures, and the appeals process.

## Content policies

### Prohibited content

| Category                | Examples                                      | Severity |
| ----------------------- | --------------------------------------------- | -------- |
| **Illegal content**     | CSAM, terrorist content, sanctions violations | Critical |
| **Harassment**          | Targeted abuse, doxxing, threats              | High     |
| **Spam**                | Automated submissions, SEO abuse              | High     |
| **Plagiarism**          | Uncredited copying, fraudulent authorship     | High     |
| **Misinformation**      | Fabricated data, falsified results            | High     |
| **Copyright violation** | Unauthorized distribution                     | Medium   |
| **Off-topic content**   | Non-scholarly submissions                     | Medium   |
| **Low quality**         | AI-generated slop, duplicate submissions      | Low      |

### Policy violations

The 13 defined violation types:

1. **Illegal material**: Content that violates law
2. **Harassment**: Targeting individuals with abuse
3. **Hate speech**: Attacks based on protected characteristics
4. **Threats**: Violence or harm directed at individuals
5. **Doxxing**: Publishing private information
6. **Spam**: Unsolicited bulk or automated content
7. **Plagiarism**: Uncredited use of others' work
8. **Data fabrication**: Falsified research data
9. **Fraudulent authorship**: False attribution
10. **Copyright violation**: Unauthorized use of copyrighted material
11. **Off-topic**: Content outside scholarly scope
12. **Duplicate submission**: Redundant submissions
13. **Manipulation**: Gaming metrics, coordinated voting

## Reporting violations

### How to report

Anyone can report content:

```http
POST /xrpc/pub.chive.moderation.report

{
  "subject": "at://did:plc:author.../pub.chive.preprint.submission/abc...",
  "violationType": "plagiarism",
  "description": "This preprint contains substantial uncredited text from...",
  "evidence": [
    {
      "type": "url",
      "value": "https://example.com/original-paper.pdf"
    }
  ]
}
```

### Report requirements

| Field           | Required    | Description                         |
| --------------- | ----------- | ----------------------------------- |
| `subject`       | Yes         | AT URI of the content               |
| `violationType` | Yes         | One of the 13 violation types       |
| `description`   | Yes         | Explanation of the violation        |
| `evidence`      | Recommended | Supporting materials                |
| `anonymous`     | Optional    | Hide reporter identity from subject |

### Reporter protections

- Reporter identity protected from accused party
- Retaliation against reporters is itself a violation
- False reports treated as manipulation

## Moderation workflow

```
┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌──────────┐
│  Report  │────►│   Review    │────►│ Decision │────►│  Action  │
│ Received │     │ (Editor)    │     │          │     │          │
└──────────┘     └─────────────┘     └──────────┘     └──────────┘
                       │                   │
                       │                   │
                       ▼                   ▼
                  Gather info        Notify parties
                  Check history      Apply sanctions
```

### Response time SLAs

| Severity | Initial review | Resolution |
| -------- | -------------- | ---------- |
| Critical | 1 hour         | 4 hours    |
| High     | 4 hours        | 24 hours   |
| Medium   | 24 hours       | 72 hours   |
| Low      | 72 hours       | 7 days     |

### Review process

1. **Triage**: Assign severity level
2. **Investigation**: Gather evidence, contact parties
3. **Decision**: Determine if violation occurred
4. **Action**: Apply appropriate response
5. **Documentation**: Record decision and rationale

## Actions and sanctions

### Content actions

| Action              | When used                           |
| ------------------- | ----------------------------------- |
| **No action**       | Report unfounded                    |
| **Warning label**   | Minor issues, user education        |
| **Content hidden**  | Visible only to author, pending fix |
| **Content removed** | Serious violations; still in PDS    |
| **Tombstone**       | Display removal notice              |

### User sanctions

| Sanction                  | Duration         | When used                      |
| ------------------------- | ---------------- | ------------------------------ |
| **Warning**               | Permanent record | First offense, minor           |
| **Temporary restriction** | 24h-30d          | Repeated minor violations      |
| **Voting suspension**     | 30d-1y           | Voting manipulation            |
| **Submission block**      | 30d-1y           | Spam, low quality              |
| **Account suspension**    | Indefinite       | Serious or repeated violations |

### Escalation ladder

```
First offense:     Warning
Second offense:    7-day restriction
Third offense:     30-day restriction
Fourth offense:    1-year suspension
Fifth offense:     Permanent suspension
```

Severe violations (harassment, fabrication) skip to appropriate level immediately.

## Trusted editor moderation

Trusted editors handle routine moderation:

### Trusted editor capabilities

| Action                   | Can perform           |
| ------------------------ | --------------------- |
| Review reports           | Yes                   |
| Issue warnings           | Yes                   |
| Hide content             | Yes                   |
| Temporary restrict (≤7d) | Yes                   |
| Remove content           | With peer review      |
| Account suspension       | Escalate to committee |

### Peer review requirement

Contentious or high-impact decisions require two editors:

```
Report received → First editor reviews → Proposes action
                                              │
                                              ▼
                                    Second editor confirms
                                              │
                                              ▼
                                        Action applied
```

## Appeals

### Appeal process

```
Decision made → 14-day appeal window → Appeal filed
                                            │
                                            ▼
                                    Appeal panel reviews
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
               Upheld               Modified               Overturned
```

### Who can appeal

- The author of actioned content
- Users who received sanctions
- Original reporter (if report dismissed)

### Appeal requirements

```http
POST /xrpc/pub.chive.moderation.appeal

{
  "decisionId": "decision-123",
  "grounds": "The content was mischaracterized as plagiarism. I have permission...",
  "evidence": [
    {
      "type": "document",
      "description": "Permission letter from original author",
      "url": "..."
    }
  ]
}
```

### Appeal panel

Appeals are reviewed by a panel of 3:

- 1 governance committee member
- 1 trusted editor (not involved in original decision)
- 1 domain expert (if applicable)

### Appeal outcomes

| Outcome        | Effect                                   |
| -------------- | ---------------------------------------- |
| **Upheld**     | Original decision stands                 |
| **Modified**   | Action adjusted (e.g., reduced sanction) |
| **Overturned** | Action reversed, records updated         |
| **Remanded**   | Sent back for additional investigation   |

## Transparency

### Public moderation log

Non-sensitive moderation data is public:

```json
{
  "id": "action-456",
  "type": "content_hidden",
  "reason": "Copyright violation",
  "timestamp": "2025-01-15T10:30:00Z",
  "appealed": false
}
```

Protected information:

- Reporter identity
- Detailed evidence
- User personal data

### Quarterly reports

Published statistics include:

- Reports received by category
- Actions taken by type
- Appeals filed and outcomes
- Response time metrics
- Trends and patterns

## Reporting moderation

### For trusted editors

```http
GET /xrpc/pub.chive.moderation.pendingReports?assignedTo=me
GET /xrpc/pub.chive.moderation.myActions?period=30d
```

### For governance committee

```http
GET /xrpc/pub.chive.moderation.statistics?period=quarter
GET /xrpc/pub.chive.moderation.escalations
```

## Next steps

- [Governance overview](./overview.md): The governance model
- [Organization](./organization.md): Governance committee structure
- [Proposals](./proposals.md): Policy change process
