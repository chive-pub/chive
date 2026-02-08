# Editing Eprints

This guide covers editing, versioning, and deleting eprints.

## Overview

Chive supports full lifecycle management for eprints:

- **Editing** updates metadata and optionally replaces the document
- **Versioning** tracks changes with semantic version numbers
- **Changelogs** document what changed between versions
- **Deletion** removes the eprint from your PDS and all indexers

All operations write to your PDS (or the paper's PDS for paper-centric submissions). Chive indexes changes from the firehose; your data remains under your control.

## Editing an Eprint

### Who Can Edit

For traditional eprints, only the submitter can edit. For paper-centric eprints (those stored in a paper account PDS), you must authenticate as the paper account.

### How to Edit

1. Navigate to your eprint
2. Click the **Edit** button (visible only if you have permission)
3. The section-based edit page opens with collapsible sections
4. Modify the fields in each section as needed
5. Select a version bump type in the Review section
6. Optionally add changelog details
7. Click **Save Changes**

### Quick Title Editing

For quick title changes, click the pencil icon next to the title on the eprint page. This opens an inline editor without navigating to the full edit page.

### Section-Based Edit Page

The edit page organizes fields into logical sections:

| Section       | Fields                            |
| ------------- | --------------------------------- |
| Metadata      | Title, abstract, keywords         |
| Authors       | Author list, affiliations, ORCID  |
| Fields        | Academic field classifications    |
| Publication   | Publication status, DOI, journal  |
| Files         | PDF document, supplementary files |
| Supplementary | Code, data, appendices            |
| Facets        | PMEST classification values       |
| Review        | Version bump, changelog           |

Sections with unsaved changes display a badge indicator. Expand or collapse sections to focus on what you need to edit.

### Editable Fields

| Field    | Description                  |
| -------- | ---------------------------- |
| Title    | Eprint title (max 500 chars) |
| Keywords | Comma-separated keyword list |
| Document | Replace the manuscript file  |

### Schema Migration

If your eprint uses an older record format, you may see a migration banner prompting you to update. Click "Update to Latest Format" to migrate your record to the latest schema. This is a one-time operation that preserves all your content.

## Semantic Versioning

Eprints use semantic versioning (MAJOR.MINOR.PATCH) to communicate the nature of changes.

### Version Format

```
1.2.3-draft
│ │ │  └── Prerelease tag (optional)
│ │ └───── Patch version
│ └─────── Minor version
└───────── Major version
```

### When to Use Each Version Type

| Type  | When to Use                                        | Examples                                           |
| ----- | -------------------------------------------------- | -------------------------------------------------- |
| Patch | Typo fixes, formatting corrections, citation fixes | "Fixed typos", "Corrected formatting"              |
| Minor | New content, significant additions, new analysis   | "Added new section", "Expanded methodology"        |
| Major | Fundamental revisions, methodology changes         | "Complete rewrite", "New experimental methodology" |

### Prerelease Tags

Optional prerelease identifiers mark work-in-progress versions:

- `1.0.0-draft`: Initial draft before formal release
- `2.0.0-rc1`: Release candidate for major revision

## Structured Changelogs

When updating an eprint, you can create a structured changelog to document your changes. Changelogs help readers understand what evolved between versions.

### Changelog Structure

A changelog contains:

- **Summary**: One-line overview (max 500 characters)
- **Sections**: Changes grouped by category
- **Reviewer Response**: Response to peer review feedback (optional)

### Changelog Categories

| Category                | Use For                                 |
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

### Change Types

Each change item can have a type:

| Type       | Meaning                        |
| ---------- | ------------------------------ |
| added      | New content that did not exist |
| changed    | Modified existing content      |
| removed    | Deleted content                |
| fixed      | Corrected errors               |
| deprecated | Content marked for removal     |

### Creating a Changelog

1. In the edit dialog, click **Changelog Details** to expand
2. Enter a brief summary
3. Click **Add Section** and select a category
4. Add change items with descriptions
5. Optionally specify location (e.g., "Section 3.2")
6. Optionally reference a reviewer comment

### Responding to Peer Review

If you are revising in response to peer review, expand the "Response to Peer Review" section to add a general response. For individual changes, use the "Review Reference" field to cite specific reviewer comments.

## Version History

The version history panel shows all versions of an eprint with their changelogs.

### Viewing Version History

1. Navigate to any eprint
2. Scroll to the **Version History** section
3. Click a version to expand its changelog details

### Information Shown

- Version number and date
- Summary of changes
- Categorized change items with types
- Location references
- Reviewer responses

## Deleting an Eprint

### Before You Delete

Deletion is permanent. The following will be removed:

- The eprint record and document from your PDS
- All endorsements associated with the eprint
- All reviews and comments on the eprint
- View and download metrics

### Who Can Delete

For traditional eprints, only the submitter can delete. For paper-centric eprints, you must authenticate as the paper account.

### How to Delete

1. Navigate to your eprint
2. Click the **Delete** button
3. Review the confirmation dialog
4. Click **Delete Eprint** to confirm

The deletion propagates from your PDS to all indexers, including Chive.

## Paper-Centric Eprints

Paper-centric eprints store data in a dedicated paper account PDS rather than your personal PDS. This model suits collaborative projects where authorship may change.

### Authentication Requirements

To edit or delete a paper-centric eprint:

1. Click Edit or Delete
2. The system prompts you to authenticate as the paper account
3. Complete the OAuth flow for the paper account
4. Proceed with your edit or deletion

### Identifying Paper-Centric Eprints

Paper-centric eprints display the paper's DID on the eprint page. The edit dialog also indicates when paper authentication is required.

## Troubleshooting

### Cannot Edit

- Verify you are signed in
- Check that you are the submitter (or authenticated as the paper account)
- For paper-centric eprints, ensure you complete the paper authentication flow

### Update Conflict

If you see "The eprint was modified by someone else," the record changed after you loaded it. Refresh the page and try again.

### Version History Not Loading

Version history queries the Chive AppView. If changelogs appear missing:

- Wait a few minutes for indexing to complete
- Refresh the page
- Check that the eprint has multiple versions

## Related Documentation

- [Submitting Eprints](./submitting-eprints.md): Initial submission process
- [Peer Review](./peer-review.md): Review and endorsement system
- [Lexicons Reference](../reference/lexicons.md): Record schemas
