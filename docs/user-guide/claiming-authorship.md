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
3. Papers are matched by name variants, ORCID, and affiliations from your profile

### Manual search

If a paper isn't suggested:

1. Click **Search External Sources**
2. Enter the paper title, DOI, or arXiv ID
3. Select the paper from results
4. Click **Start Claim**

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

To get better paper suggestions:

- Link your ORCID to your Chive profile
- Add name variants (maiden name, initials, etc.) in profile settings
- Add your institutional affiliations

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
