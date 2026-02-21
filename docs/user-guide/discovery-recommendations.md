# Discovery and recommendations

Chive helps you find relevant eprints through personalized recommendations, related paper suggestions, and citation networks.

## For You feed

The For You feed on your homepage shows personalized recommendations based on:

| Signal               | Description                                            |
| -------------------- | ------------------------------------------------------ |
| Your research fields | Papers in fields you follow or publish in              |
| Citation network     | Papers citing your work or cited by papers you've read |
| Semantic similarity  | Papers similar to ones you've engaged with             |

Signals are combined using a scoring algorithm that considers recency, relevance, and diversity.

### Customizing recommendations

1. Go to **Settings** → **Discovery**
2. Adjust your preferences:
   - **Follow fields**: Add or remove research areas
   - **Discovery mode**: Balance between relevance and serendipity
   - **Exclude sources**: Hide papers from specific archives

### Feedback loop

Your interactions improve recommendations:

| Action                        | Effect                              |
| ----------------------------- | ----------------------------------- |
| Reading a paper (>30 seconds) | Increases weight for similar papers |
| Downloading PDF               | Strong signal for related topics    |
| Endorsing or reviewing        | Strongest positive signal           |
| Dismissing                    | Reduces weight for similar papers   |

Click the **X** on any recommendation to dismiss it and improve future suggestions.

## Related papers

Each eprint page shows related papers in the sidebar:

### How related papers are found

Related papers come from two sources:

**Auto-detected**: The system finds related papers using:

1. **Elasticsearch MLT**: Text similarity based on title, abstract, and keywords
2. **Citation overlap**: Papers that cite the same references (when citation data is available)
3. **Co-citation**: Papers frequently cited together

**User-curated**: Any authenticated user can add related papers manually using the "Add Related Paper" button. User-curated links include a relationship type (extends, replicates, contradicts, etc.) and optional description.

Both sources appear in a single "Related Papers" panel on the eprint page.

### Relationship types

User-curated related papers display a relationship badge:

| Badge       | Meaning                       |
| ----------- | ----------------------------- |
| Related     | Generally related work        |
| Extends     | Builds upon this paper        |
| Replicates  | Replication study             |
| Contradicts | Contradicts findings          |
| Reviews     | Reviews or surveys this paper |

### Citation network

Chive can extract citations from eprint PDFs using GROBID. When citations are available:

1. Click the **Related** tab on any eprint page
2. View the **Citation Network** section showing extracted references
3. Citations that match existing Chive eprints are linked

## Field browsing

### Exploring by field

1. Go to **Browse** → **Fields**
2. Navigate the hierarchy
3. Each field shows:
   - Recent papers
   - Trending papers
   - Top authors
   - Related fields

### Field statistics

Each field page displays:

- Total papers
- Papers this week/month
- Top contributors
- Most-cited papers
- Active discussions

## Trending and popular

### Trending now

The **Trending** section shows papers gaining attention:

- Based on views, downloads, and engagement in the last 24-48 hours
- Weighted toward recency
- Filtered by your followed fields (optional)

### Most discussed

Papers with active review threads and endorsements:

- Sorted by recent activity
- Shows discussion summary
- Highlights key debates

## Following

### Following fields

1. Go to any field page
2. Click **Follow**
3. New papers appear in your For You feed

### Following authors

1. Visit an author's profile
2. Click **Follow**
3. Their new papers appear in your feed

### Managing follows

Go to **Profile** → **Following** to see and manage all your follows.

## Discovery settings

| Setting                       | Options                        | Default |
| ----------------------------- | ------------------------------ | ------- |
| Recommendation diversity      | Low / Medium / High            | Medium  |
| Include eprints from          | All sources / Selected sources | All     |
| Show papers in languages      | Select languages               | English |
| Minimum endorsement threshold | 0 / 1 / 3 / 5                  | 0       |

## Privacy

Your discovery activity is private by default:

- Reading history is not shared
- Followed fields are private unless you choose to display them
- Dismissed papers are not disclosed

## Related topics

- [Searching](./searching.md): Full search guide
- [For You personalization](../concepts/data-sovereignty.md): How data is used
- [Profiles](./profiles.md): Managing your followed fields
