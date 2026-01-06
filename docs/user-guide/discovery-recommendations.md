# Discovery and recommendations

Chive helps you find relevant preprints through personalized recommendations, related paper suggestions, and citation networks.

## For You feed

The For You feed on your homepage shows personalized recommendations based on:

| Signal               | Weight | Description                                            |
| -------------------- | ------ | ------------------------------------------------------ |
| Your research fields | 60%    | Papers in fields you follow or publish in              |
| Citation network     | 25%    | Papers citing your work or cited by papers you've read |
| Semantic similarity  | 30%    | Papers similar to ones you've engaged with             |

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

Each preprint page shows related papers in the sidebar:

### How similarity is calculated

1. **Citation overlap**: Papers that cite the same references
2. **Concept overlap**: Shared fields, tags, and keywords
3. **Semantic similarity**: Text similarity using SPECTER2 embeddings
4. **Co-citation**: Papers frequently cited together

### Filtering related papers

Click **Filter** above the related papers panel:

- **All**: Default mixed ranking
- **Cites this**: Papers that cite this preprint
- **Cited by this**: References from this preprint
- **Similar methods**: Papers using similar methodology
- **Same authors**: Other papers by the same authors

## Citation network

### Exploring citations

On any preprint page:

1. Click the **Citations** tab
2. View **Cited by** (incoming citations)
3. View **References** (outgoing citations)
4. Click any paper to explore further

### Citation graph visualization

Click **View Graph** to see an interactive citation network:

- Nodes represent papers
- Edges represent citations
- Node size indicates citation count
- Color indicates research field

Navigate by:

- Clicking nodes to center
- Scrolling to zoom
- Dragging to pan
- Double-clicking to open paper details

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

## Saved searches and alerts

### Saving a search

1. Perform any search
2. Click **Save Search**
3. Name your saved search
4. Choose notification frequency:
   - Real-time
   - Daily digest
   - Weekly digest

### Managing alerts

Go to **Settings** → **Alerts** to:

- View saved searches
- Edit notification preferences
- Pause or delete alerts

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
| Include preprints from        | All sources / Selected sources | All     |
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
