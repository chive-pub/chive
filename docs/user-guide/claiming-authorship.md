# Claiming authorship

When you sign up for Chive, your existing eprints from arXiv, bioRxiv, and other sources aren't automatically linked to your account. The claiming process lets you verify and take ownership of your prior work.

## Why claim authorship?

Claiming links imported eprints to your Chive identity:

- Your claimed papers appear on your profile
- You receive notifications for reviews and endorsements
- Your papers show as "verified" to other users
- You can respond to reviews and engage with readers

## Finding your papers

### Automatic suggestions

After you complete your profile (especially ORCID linking), Chive suggests papers that may be yours:

1. Go to **Dashboard** → **Import Your Papers**
2. Review the **Suggested For You** tab

Suggestions are ranked by a multi-signal scoring system. Each paper receives a score from 0 to 100; only papers scoring 10 or above appear in your suggestions.

**Identity signals (0-50 pts)**

| Signal                                                   | Points |
| -------------------------------------------------------- | ------ |
| ORCID exact match                                        | 50     |
| External ID match (Semantic Scholar, OpenAlex author ID) | 40     |

**Name matching (0-30 pts)**

Name matching is token-based: your name is split into tokens and compared against each author entry on the paper.

| Match type                         | Points |
| ---------------------------------- | ------ |
| Exact full name                    | 30     |
| Partial match (2+ matching tokens) | 15     |
| Single token match                 | 5      |

Name scores are penalized by author count to reduce false matches on large collaborations:

| Author count | Score multiplier |
| ------------ | ---------------- |
| 1-10         | 100%             |
| 11-50        | 50%              |
| 51-200       | 20%              |
| 200+         | 5%               |

**Content overlap (0-30 pts, acts as a gate)**

Papers are checked against your research fields using the OpenAlex topic taxonomy. If a paper has no field overlap with your profile AND scores below 40 from identity and name signals alone, its score is capped at 5 (effectively filtered out). This prevents irrelevant matches; for example, a linguist named "White" will not see ATLAS particle physics papers authored by a different "White."

**Network signals (0-20 pts)**

| Signal                                     | Points |
| ------------------------------------------ | ------ |
| Affiliation match                          | 10     |
| Co-author overlap with your claimed papers | 10     |

#### Suggestion sources

Suggestions come from two places:

- **On Chive**: Papers already on Chive that may be yours. These appear first and include "View on Chive" and "Request Co-authorship" options.
- **External sources**: Papers from arXiv, Semantic Scholar, OpenAlex, and other indexed sources. These include an "Import Paper" option.

Duplicates across sources are automatically removed by matching on DOI.

#### Dismissing suggestions

To dismiss a suggestion you are not interested in, click the **X** button on the suggestion card. Dismissed papers will not appear in future suggestions. Dismissals are stored server-side and persist across sessions.

### Manual search

If a paper isn't suggested:

1. Click **Search External Sources**
2. Enter the paper title, DOI, or arXiv ID
3. Select the paper from results
4. Click **Start Claim**

If a particular external source is temporarily unavailable, a warning banner indicates which sources encountered errors. Results from the remaining working sources are still displayed.

## The verification process

Chive verifies claims using multiple evidence sources linked to your profile.

### Evidence sources

| Source                | How it works                                                |
| --------------------- | ----------------------------------------------------------- |
| ORCID                 | Paper linked to your verified ORCID iD (highest confidence) |
| Semantic Scholar      | Paper claimed on your Semantic Scholar profile              |
| OpenReview            | Paper submitted via your OpenReview account                 |
| OpenAlex              | Paper linked to your OpenAlex author ID                     |
| arXiv ownership       | You're listed as paper owner on arXiv                       |
| Institutional email   | Your handle domain matches the paper's affiliation          |
| Coauthor confirmation | A verified coauthor confirms your authorship                |
| Name match            | Author name matches your profile (lowest confidence)        |

### Verification process

1. **Link accounts**: Connect ORCID, Semantic Scholar, or other academic profiles to your Chive account
2. **Start claim**: Select a paper and initiate the claim process
3. **Evidence collection**: Chive checks your linked accounts for matching records
4. **Review**: Claims with strong evidence (ORCID match) are prioritized; weaker evidence may require manual review

## Completing a claim

Once you import a paper:

1. Your Chive client creates a `pub.chive.eprint.submission` record in your Personal Data Server (PDS)
2. Chive indexes the record and links it to your AT Protocol identity
3. The paper appears on your profile

### What gets created

The import creates a `pub.chive.eprint.submission` record in your PDS containing:

- Paper metadata (title, abstract, authors)
- Link to the original source (arXiv, bioRxiv, etc.)
- BlobRef pointing to the PDF in the original repository

You own this record. It stays in your PDS even if you leave Chive.

## Claim statuses

| Status   | Meaning                                   |
| -------- | ----------------------------------------- |
| Pending  | Claim submitted, awaiting record creation |
| Approved | Record created and indexed                |
| Rejected | Claim could not be verified               |

## Troubleshooting

### My paper wasn't found

- Try searching by DOI or arXiv ID instead of title
- Check that the paper is indexed in arXiv, OpenReview, or other supported sources
- Recently published papers may take a few days to appear

### Improving your suggestions

To get better paper suggestions, listed from highest to lowest impact:

- **Link your ORCID** (50 pts): The strongest identity signal. An exact ORCID match guarantees a paper appears in your suggestions.
- **Add research keywords** to your profile: Enables content overlap scoring, which filters out papers outside your fields.
- **Claim papers on Chive**: Each claimed paper builds your topic profile and co-author network, improving network signal scores.
- **Add institutional affiliations**: Enables affiliation matching (10 pts per match).
- **Add name variants** (maiden name, initials, etc.) in profile settings: Improves token-based name matching accuracy.

### The wrong person claimed my paper

Report the claim:

1. Go to the paper's page
2. Click **Report** → **Incorrect authorship claim**
3. Provide evidence of your authorship

Disputed claims are reviewed by trusted editors.

## Privacy considerations

- Your claim history is visible only to you
- Rejected claims are not public
- You can withdraw a pending claim at any time
- Verified claims are public (the paper shows on your profile)

## Related topics

- [Profiles](./profiles.md): Setting up your profile
- [Submitting Eprints](./submitting-eprints.md): Adding new papers
- [Endorsements](./endorsements.md): Endorsing claimed papers
