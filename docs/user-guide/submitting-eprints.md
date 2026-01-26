# Submitting Eprints

This guide covers the eprint submission process in detail.

## Before You Submit

Ensure you have:

- A PDF of your eprint (maximum 100 MB)
- Required metadata: title, abstract, keywords
- An AT Protocol account (e.g., Bluesky)
- Co-author consent for multi-author submissions

## Submission Workflow

### Step 1: Authentication

Click "Sign In" and authenticate with your PDS. Chive uses OAuth 2.0 for authentication; your credentials are never stored on Chive servers.

### Step 2: Start Submission

Click "Submit Eprint" to open the submission form. The form has four sections.

### Step 3: Basic Information

| Field    | Required | Description                                  |
| -------- | -------- | -------------------------------------------- |
| Title    | Yes      | Full title of your eprint                    |
| Abstract | Yes      | Plain text summary (recommended: 300 words)  |
| Keywords | Yes      | At least one author-provided keyword         |
| License  | Yes      | Creative Commons license (CC-BY recommended) |

### Step 4: Authors

Add all authors with their affiliations:

1. Click "Add Author"
2. Enter name and affiliation
3. Optionally link to ORCID
4. Drag to reorder authors
5. Mark corresponding author

### Step 5: Upload Files

**PDF Upload**

Drag and drop your PDF or click to select. The file uploads directly to your PDS. Chive stores only a reference (BlobRef) to the file.

**Supplementary Materials** (optional)

Add datasets, code, or additional figures. Each file has a 50 MB limit. Supported formats: PDF, ZIP, TAR.GZ.

### Step 6: Classification

Select fields from the knowledge graph:

1. Type to search for fields
2. Click to select (maximum five fields)
3. Selected fields appear as tags
4. Click X to remove a field

### Step 7: Review and Submit

Review all information on the summary page. Click "Submit" to create the eprint record in your PDS.

## After Submission

Your eprint is indexed within minutes. You receive a permanent URL to share with colleagues.

### Editing and Versioning

You can edit your eprint metadata and upload new versions at any time. Each version uses semantic versioning (MAJOR.MINOR.PATCH) and supports structured changelogs. See [Editing Eprints](./editing-eprints.md) for details.

### Deleting

You can delete your eprint from Chive. The deletion propagates from your PDS to all indexers. See [Editing Eprints](./editing-eprints.md) for details.

## Multi-Author Submissions

For eprints with multiple authors:

1. One author (the submitter) creates the submission
2. Co-authors can claim their authorship through the claiming flow
3. The submitter can also send co-author requests to link verified accounts

## Troubleshooting

**Upload fails**

Check file size (maximum 100 MB) and format (PDF only for main manuscript).

**Cannot find field**

If your field is not in the knowledge graph, propose it via the governance system.

**Indexing delayed**

New submissions typically appear within five minutes. If your eprint is not visible after one hour, contact support.
