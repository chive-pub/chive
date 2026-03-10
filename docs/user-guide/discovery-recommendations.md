# Discovery and recommendations

Chive helps you find relevant eprints through personalized recommendations, related paper suggestions, and citation networks.

## Browsing eprints

The `/eprints` page is the main entry point for discovering new papers. What you see depends on your authentication state and profile configuration.

### Authenticated users with research fields

If you are signed in and have research fields set in your profile, the page displays **New in Your Fields**: recently submitted eprints matching your fields, sorted chronologically. This view uses the `searchSubmissions` endpoint with `sort=recent` and field URI filtering.

### Authenticated users without research fields

If you are signed in but have not set any research fields, the page prompts you to configure your profile with at least one research field. Until you do, it falls back to the trending view described below.

### Anonymous users

Visitors who are not signed in see **Trending This Week**, the same global trending feed shown on the `/trending` page.

## Related papers

Each eprint page shows related papers in the sidebar:

### How related papers are found

Related papers are ranked using five weighted signals. You can customize these weights in your [discovery settings](#configurable-discovery-weights):

| Signal                               | Default weight | Source                      |
| ------------------------------------ | -------------- | --------------------------- |
| SPECTER2 semantic similarity         | 30%            | Semantic Scholar embeddings |
| Co-citation + bibliographic coupling | 25%            | Neo4j citation graph        |
| OpenAlex concept/topic overlap       | 20%            | OpenAlex 4-level taxonomy   |
| Author network                       | 15%            | Co-author overlap           |
| Collaborative filtering              | 10%            | User engagement patterns    |

**Auto-detected**: The system finds related papers using:

1. **SPECTER2 embeddings**: Dense vector similarity from Semantic Scholar (with Elasticsearch MLT fallback when embeddings are unavailable)
2. **Co-citation analysis**: Papers that are frequently cited together
3. **Bibliographic coupling**: Papers that cite the same references
4. **OpenAlex concept overlap**: Shared topics in the 4-level hierarchy (domain > field > subfield > topic)
5. **Author network**: Papers sharing one or more authors

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

1. Go to **Browse** > **Fields**
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

The `/trending` page shows papers gaining attention based on views, downloads, and engagement in the last 24-48 hours, weighted toward recency.

**Authenticated users with research fields** see two sections:

1. **Trending in Your Fields**: Papers matching your research fields, shown first
2. **Trending Globally**: Papers trending across all fields

A toggle at the top of the page switches between **My Fields** and **All** views.

**Anonymous users** see the global trending feed with no field filtering.

### Most discussed

Papers with active review threads and endorsements:

- Sorted by recent activity
- Shows discussion summary
- Highlights key debates

## Following

### Following fields

1. Go to any field page
2. Click **Follow**
3. New papers appear on your `/eprints` page and in field-filtered trending

### Following authors

1. Visit an author's profile
2. Click **Follow**
3. Their new papers appear in your feed

### Managing follows

Go to **Profile** > **Following** to see and manage all your follows.

## Managing suggestions

Your interactions improve recommendations over time:

| Action                        | Effect                                |
| ----------------------------- | ------------------------------------- |
| Reading a paper (>30 seconds) | Increases weight for similar papers   |
| Downloading PDF               | Strong signal for related topics      |
| Endorsing or reviewing        | Strongest positive signal             |
| Dismissing (click **X**)      | Paper is hidden and will not reappear |

:::info
The dismiss functionality is planned and may not yet be available.
:::

To dismiss a recommendation, click the **X** button on any suggested paper. Dismissed papers are removed from all recommendation surfaces and will not reappear.

## Discovery settings

### General preferences

| Setting                       | Options                        | Default |
| ----------------------------- | ------------------------------ | ------- |
| Recommendation diversity      | Low / Medium / High            | Medium  |
| Include eprints from          | All sources / Selected sources | All     |
| Show papers in languages      | Select languages               | English |
| Minimum endorsement threshold | 0 / 1 / 3 / 5                  | 0       |

### Configurable discovery weights

You can tune how related papers are ranked by adjusting the weight of each signal in **Settings > Discovery > Related Papers Weights**. Each weight is a value from 0 to 100; the system normalizes them so they sum to 100%.

| Weight                  | Controls                                                             | Default |
| ----------------------- | -------------------------------------------------------------------- | ------- |
| Field affinity          | How much shared research fields influence recommendations            | 30      |
| Citation overlap        | How much co-citation and bibliographic coupling influence ranking    | 25      |
| Recency                 | How strongly recently published papers are boosted                   | 20      |
| Collaborative filtering | How much user engagement patterns (views, downloads) influence picks | 10      |

Setting a weight to 0 disables that signal entirely. For example, setting collaborative filtering to 0 produces recommendations based only on content similarity, citation graphs, and field overlap.

### Related papers scoring thresholds

You can also adjust the minimum score for a paper to appear in the "Related Papers" panel:

| Threshold       | Controls                                                | Default |
| --------------- | ------------------------------------------------------- | ------- |
| Minimum score   | Papers scoring below this are hidden (0.0 to 1.0 scale) | 0.3     |
| Minimum signals | Number of signals that must contribute a nonzero score  | 1       |

Lower the minimum score to see more results; raise it to see only high-confidence matches.

## Privacy

Your discovery activity is private by default:

- Reading history is not shared
- Followed fields are private unless you choose to display them
- Dismissed papers are stored server-side but not disclosed to other users

## Next steps

- [Searching](./searching): Full search guide with filters and syntax
- [Profiles](./profiles): Managing your research fields and followed topics
- [Tags and classification](./tags-and-classification): How fields and tags organize eprints
