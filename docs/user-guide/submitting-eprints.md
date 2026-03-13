# Submitting eprints

This guide covers the eprint submission process in detail.

## Before you submit

Ensure you have:

- A PDF of your eprint (maximum 50 MB)
- Required metadata: title, abstract, keywords
- An AT Protocol account (e.g., Bluesky)
- Co-author consent for multi-author submissions

## Submission workflow

### Step 1: Authentication

Click "Sign In" and authenticate with your PDS. Chive uses OAuth 2.0 for authentication; your credentials are never stored on Chive servers.

### Step 2: Start submission

Click "Submit Eprint" to open the submission form. The form has four sections.

### Step 3: Basic information

| Field    | Required | Description                                                     |
| -------- | -------- | --------------------------------------------------------------- |
| Title    | Yes      | Full title of your eprint. LaTeX math is detected and rendered. |
| Abstract | Yes      | Rich text summary supporting formatting, LaTeX, and references  |
| Keywords | Yes      | At least one author-provided keyword                            |
| License  | Yes      | Creative Commons license (CC-BY recommended)                    |

Titles containing LaTeX expressions (e.g., `$\alpha$-decay`) are automatically detected. A rich text version (`titleRich`) is generated with the math rendered inline.

Abstracts support rich text items including plain text, LaTeX math, entity references (knowledge graph nodes, other eprints, authors), code blocks, headings, and lists.

### Step 4: Authors

Add all authors with their affiliations:

1. Click "Add Author"
2. Enter name and institutional affiliation
3. Add sub-units within the affiliation (e.g., University > School > Department > Lab)
4. Optionally link to ORCID
5. Assign CRediT contribution roles (conceptualization, methodology, writing, etc.)
6. Drag to reorder authors
7. Mark corresponding author

Affiliations are stored as hierarchical trees linked to ROR identifiers and knowledge graph institution nodes.

### Step 5: Upload files

**PDF upload**

Drag and drop your PDF or click to select. The file uploads directly to your PDS. Chive stores only a reference (BlobRef) to the file.

**Supplementary materials** (optional)

Add datasets, code, or additional figures. Each file has a 100 MB limit. Supported formats: PDF, ZIP, TAR.GZ.

### Step 6: Publication details

This step collects optional metadata about the eprint's publication and linked resources.

**Code and data repositories**

Link code and data repositories associated with your eprint. Each entry includes:

- **URL**: Link to the repository (e.g., `https://github.com/user/repo`)
- **Platform**: Select from the knowledge graph (GitHub, GitLab, Zenodo, Figshare, Dryad, OSF, Software Heritage, etc.)
- **Label**: Optional description (e.g., "Experiment scripts", "Training data")

You can add multiple code repositories and multiple data repositories.

**Pre-registration**

If your study was pre-registered, provide the registration URL and select the platform (e.g., OSF Registries, ClinicalTrials.gov, AsPredicted).

**External IDs**

Link your eprint to records on other platforms:

| Field       | Description                               | Autocomplete |
| ----------- | ----------------------------------------- | ------------ |
| arXiv ID    | arXiv paper identifier (e.g., 2401.12345) | Yes          |
| PMID        | PubMed identifier                         | Yes          |
| PMC ID      | PubMed Central identifier                 | No           |
| SSRN ID     | SSRN paper identifier                     | No           |
| OSF ID      | Open Science Framework identifier         | No           |
| Zenodo DOI  | Zenodo deposit DOI                        | No           |
| OpenAlex ID | OpenAlex work identifier                  | No           |

**Funding**

Add funding sources with funder name, grant number, grant title, and grant URL.

**Conference**

If the eprint was presented at a conference, add the conference name, location, date, and presentation type.

### Step 7: Classification

Select fields from the knowledge graph:

1. Type to search for fields
2. Click to select (maximum five fields)
3. Selected fields appear as tags
4. Click X to remove a field

### Step 8: Review and submit

Review all information on the summary page. Click "Submit" to create the eprint record in your PDS.

## After submission

Your eprint is indexed within minutes. You receive a permanent URL to share with colleagues.

### Editing and versioning

You can edit your eprint metadata and upload new versions at any time. Each version uses semantic versioning (MAJOR.MINOR.PATCH) and supports structured changelogs. See [Editing eprints](./editing-eprints) for details.

### Deleting

You can delete your eprint from Chive. The deletion propagates from your PDS to all indexers. See [Editing eprints](./editing-eprints) for details.

## Multi-author submissions

For eprints with multiple authors:

1. One author (the submitter) creates the submission
2. Co-authors can claim their authorship through the claiming flow
3. The submitter can also send co-author requests to link verified accounts

## Troubleshooting

**Upload fails**

Check file size (maximum 50 MB) and format (PDF only for main manuscript).

**Cannot find field**

If your field is not in the knowledge graph, propose it via the governance system.

**Indexing delayed**

New submissions typically appear within five minutes. If your eprint is not visible after one hour, contact support.
