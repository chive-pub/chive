# Claiming authorship

When you sign up for Chive, your existing preprints from arXiv, bioRxiv, and other sources aren't automatically linked to your account. The claiming process lets you verify and take ownership of your prior work.

## Why claim authorship?

Claiming links imported preprints to your Chive identity:

- Your claimed papers appear on your profile
- You receive notifications for reviews and endorsements
- Your papers show as "verified" to other users
- You can respond to reviews and engage with readers

## Finding your papers

### Automatic suggestions

After you complete your profile (especially ORCID linking), Chive suggests papers that may be yours:

1. Go to **Profile** → **Claim Papers**
2. Review the suggested papers
3. Papers are matched by name, ORCID, email domain, and institutional affiliation

### Manual search

If a paper isn't suggested:

1. Click **Search External Sources**
2. Enter the paper title, DOI, or arXiv ID
3. Select the paper from results
4. Click **Start Claim**

## The verification process

Chive verifies claims using multiple evidence sources. Each source contributes to your verification score.

### Evidence sources

| Source                | Weight | How it works                                               |
| --------------------- | ------ | ---------------------------------------------------------- |
| ORCID match           | 35%    | Paper linked to your verified ORCID                        |
| Semantic Scholar      | 15%    | Paper claimed on your S2 profile                           |
| OpenReview            | 15%    | Paper submitted via your OpenReview account                |
| OpenAlex              | 10%    | Paper linked to your OpenAlex author ID                    |
| arXiv ownership       | 10%    | You're listed as paper owner on arXiv                      |
| Institutional email   | 8%     | Your Bluesky handle domain matches the paper's affiliation |
| Coauthor confirmation | 5%     | A verified coauthor confirms your authorship               |
| Name match            | 2%     | Author name matches your profile                           |

### Verification outcomes

| Score         | Outcome                                     |
| ------------- | ------------------------------------------- |
| 90% or higher | Automatically approved                      |
| 70-89%        | Expedited review (approved within 24 hours) |
| 50-69%        | Manual review required                      |
| Below 50%     | Additional evidence needed                  |

## Completing a claim

Once your claim is verified:

1. Chive creates a canonical record in your Personal Data Server (PDS)
2. The imported preprint is linked to your AT Protocol identity
3. The paper appears on your profile as "verified"

### What gets created

The claim creates a `pub.chive.preprint.submission` record in your PDS containing:

- Paper metadata (title, abstract, authors)
- Link to the original source (arXiv, bioRxiv, etc.)
- BlobRef pointing to the PDF in the original repository

You own this record. It stays in your PDS even if you leave Chive.

## Claim statuses

| Status       | Meaning                             |
| ------------ | ----------------------------------- |
| Pending      | Claim submitted, gathering evidence |
| Under review | Manual review in progress           |
| Approved     | Claim verified, record created      |
| Rejected     | Claim could not be verified         |
| Withdrawn    | You cancelled the claim             |

## Troubleshooting

### My paper wasn't found

- Try searching by DOI instead of title
- Check that the paper is indexed in arXiv, bioRxiv, Semantic Scholar, or OpenAlex
- Recently published papers may take a few days to appear

### My score is too low

Add more evidence:

- Link your ORCID to your Chive profile
- Claim the paper on Semantic Scholar
- Ask a verified coauthor to confirm your authorship

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
- [Submitting Preprints](./submitting-preprints.md): Adding new papers
- [Endorsements](./endorsements.md): Endorsing claimed papers
