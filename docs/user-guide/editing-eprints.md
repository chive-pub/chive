# Editing eprints

This guide covers editing, versioning, and deleting eprints.

## Overview

Chive supports full lifecycle management for eprints:

- **Editing** updates metadata and optionally replaces the document
- **Versioning** tracks changes with semantic version numbers
- **Changelogs** document what changed between versions
- **Deletion** removes the eprint from your PDS and all indexers

All operations write to your PDS (or the paper's PDS for paper-centric submissions). Chive indexes changes from the firehose; your data remains under your control.

## Editing an eprint

### Who can edit

For traditional eprints, only the submitter can edit. For paper-centric eprints (those stored in a paper account PDS), you must authenticate as the paper account.

### How to edit

1. Navigate to your eprint
2. Click the **Edit** button (visible only if you have permission)
3. The section-based edit page opens with collapsible sections
4. Modify the fields in each section as needed
5. Select a version bump type in the Review section
6. Optionally add changelog details
7. Click **Save Changes**

### Quick title editing

For quick title changes, click the pencil icon next to the title on the eprint page. This opens an inline editor without navigating to the full edit page.

### Section-based edit page

The edit page organizes fields into logical sections:

| Section                         | Fields                                                           |
| ------------------------------- | ---------------------------------------------------------------- |
| Metadata                        | Title, abstract, keywords                                        |
| Authors                         | Author list, affiliations, ORCID                                 |
| Fields                          | Academic field classifications                                   |
| Publication                     | Publication status, DOI, journal, volume, pages, published date  |
| External IDs                    | arXiv ID, PMID, PMC ID, SSRN ID, OSF ID, Zenodo DOI, OpenAlex ID |
| Files                           | PDF document, supplementary files                                |
| Repositories & pre-registration | Code repositories, data repositories, pre-registration links     |
| Facets                          | PMEST classification values                                      |
| Review                          | Version bump, changelog                                          |

Sections with unsaved changes display a badge indicator. Expand or collapse sections to focus on what you need to edit.

### Editable fields

The edit form supports the same fields as the submission wizard:

| Field             | Description                                                         |
| ----------------- | ------------------------------------------------------------------- |
| Title             | Eprint title (max 500 chars)                                        |
| Abstract          | Plain text or rich text abstract                                    |
| Keywords          | Comma-separated keyword list                                        |
| Document          | Replace the manuscript file                                         |
| Code repositories | Multiple entries, each with URL, platform (e.g., GitHub), and label |
| Data repositories | Multiple entries, each with URL, platform, and label                |
| Pre-registration  | URL and platform for pre-registration records                       |
| External IDs      | arXiv ID, PMID, PMC ID, SSRN ID, OSF ID, Zenodo DOI, OpenAlex ID    |
| Published version | DOI, journal, volume, pages, published date, publisher URL          |
| Funding           | Funder name, grant number, grant title, grant URL                   |
| Conference        | Conference name, location, date, presentation type                  |

### Repositories

The Repositories & pre-registration section supports multiple code and data repository entries. Each entry includes:

- **URL**: Link to the repository
- **Platform**: Selected from the knowledge graph (GitHub, GitLab, Zenodo, Figshare, Dryad, etc.)
- **Label**: Optional description (e.g., "Main analysis code")

Click "Add Repository" to add additional entries. Click the X button on any entry to remove it.

Pre-registration links follow the same pattern but without a label field. Select a platform (e.g., OSF Registries, ClinicalTrials.gov) and provide the URL.

### External IDs

The External IDs section provides autocomplete-assisted entry for arXiv IDs and PubMed IDs. Type a query to search, then select from results to populate the field automatically. The remaining IDs (PMC ID, SSRN ID, OSF ID, Zenodo DOI, OpenAlex ID) are plain text inputs.

### Schema migration

If your eprint uses an older record format, you may see a migration banner prompting you to update. Click "Update to Latest Format" to migrate your record to the latest schema. This is a one-time operation that preserves all your content.

## Semantic versioning

Eprints use semantic versioning (MAJOR.MINOR.PATCH) to communicate the nature of changes.

### Version format

```text
1.2.3-draft
│ │ │  └── Prerelease tag (optional)
│ │ └───── Patch version
│ └─────── Minor version
└───────── Major version
```

### When to use each version type

| Type  | When to use                                        | Examples                                           |
| ----- | -------------------------------------------------- | -------------------------------------------------- |
| Patch | Typo fixes, formatting corrections, citation fixes | "Fixed typos", "Corrected formatting"              |
| Minor | New content, significant additions, new analysis   | "Added new section", "Expanded methodology"        |
| Major | Fundamental revisions, methodology changes         | "Complete rewrite", "New experimental methodology" |

### Prerelease tags

Optional prerelease identifiers mark work-in-progress versions:

- `1.0.0-draft`: Initial draft before formal release
- `2.0.0-rc1`: Release candidate for major revision

## Structured changelogs

When updating an eprint, you can create a structured changelog to document your changes. Changelogs help readers understand what evolved between versions.

### Changelog structure

A changelog contains:

- **Summary**: One-line overview (max 500 characters)
- **Sections**: Changes grouped by category
- **Reviewer response**: Response to peer review feedback (optional)

### Changelog categories

| Category                | Use for                                 |
| ----------------------- | --------------------------------------- |
| methodology             | Changes to research methods             |
| results                 | New or updated results                  |
| analysis                | Changes to data analysis                |
| discussion              | Updates to discussion section           |
| conclusions             | Changed conclusions                     |
| data                    | Data updates or corrections             |
| figures                 | New or updated figures                  |
| tables                  | New or updated tables                   |
| references              | Bibliography changes                    |
| supplementary-materials | Updates to supplementary files          |
| corrections             | Error corrections                       |
| formatting              | Layout and formatting changes           |
| language-editing        | Grammar, style, or clarity improvements |
| acknowledgments         | Updates to acknowledgments              |
| authorship              | Author list changes                     |
| other                   | Changes not fitting other categories    |

### Change types

Each change item can have a type:

| Type    | Meaning                        |
| ------- | ------------------------------ |
| added   | New content that did not exist |
| changed | Modified existing content      |
| removed | Deleted content                |
| fixed   | Corrected errors               |

### Creating a changelog

1. In the edit dialog, click **Changelog Details** to expand
2. Enter a brief summary
3. Click **Add Section** and select a category
4. Add change items with descriptions
5. Optionally specify location (e.g., "Section 3.2")
6. Optionally reference a reviewer comment

### Responding to peer review

If you are revising in response to peer review, expand the "Response to Peer Review" section to add a general response. For individual changes, use the "Review Reference" field to cite specific reviewer comments.

## Version history

The version history panel shows all versions of an eprint with their changelogs.

### Viewing version history

1. Navigate to any eprint
2. Scroll to the **Version History** section
3. Click a version to expand its changelog details

### Information shown

- Version number and date
- Summary of changes
- Categorized change items with types
- Location references
- Reviewer responses

## Deleting an eprint

### Before you delete

Deletion is permanent. The following will be removed:

- The eprint record and document from your PDS
- All endorsements associated with the eprint
- All reviews and comments on the eprint
- View and download metrics

### Who can delete

For traditional eprints, only the submitter can delete. For paper-centric eprints, you must authenticate as the paper account.

### How to delete

1. Navigate to your eprint
2. Click the **Delete** button
3. Review the confirmation dialog
4. Click **Delete Eprint** to confirm

The deletion propagates from your PDS to all indexers, including Chive.

## Paper-centric eprints

Paper-centric eprints store data in a dedicated paper account PDS rather than your personal PDS. This model suits collaborative projects where authorship may change.

### Authentication requirements

To edit or delete a paper-centric eprint:

1. Click Edit or Delete
2. The system prompts you to authenticate as the paper account
3. Complete the OAuth flow for the paper account
4. Proceed with your edit or deletion

### Identifying paper-centric eprints

Paper-centric eprints display the paper's DID on the eprint page. The edit dialog also indicates when paper authentication is required.

## Troubleshooting

### Cannot edit

- Verify you are signed in
- Check that you are the submitter (or authenticated as the paper account)
- For paper-centric eprints, ensure you complete the paper authentication flow

### Update conflict

If you see "The eprint was modified by someone else," the record changed after you loaded it. Refresh the page and try again.

### Version history not loading

Version history queries the Chive AppView. If changelogs appear missing:

- Wait a few minutes for indexing to complete
- Refresh the page
- Check that the eprint has multiple versions

## Next steps

- [Submitting eprints](./submitting-eprints): Initial submission process.
- [Peer review](./peer-review): Review and endorsement system.
- [Lexicons reference](../reference/lexicons): Record schemas for eprint records.
