# Lexicons reference

Chive uses the `pub.chive.*` namespace for all AT Protocol lexicons. This reference documents all record types and their schemas.

## Namespace overview

| Namespace                | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| `pub.chive.eprint.*`     | Eprint submissions and versions            |
| `pub.chive.review.*`     | Reviews and endorsements                   |
| `pub.chive.graph.*`      | Knowledge graph (fields, proposals, votes) |
| `pub.chive.actor.*`      | User profiles and settings                 |
| `pub.chive.tag.*`        | User-generated tags                        |
| `pub.chive.richtext.*`   | Shared rich text definitions               |
| `pub.chive.governance.*` | Governance records (in Governance PDS)     |

## Rich text system

Chive uses a unified rich text system for titles, abstracts, and review comments. Rich text is represented as arrays of typed items, enabling structured content with formatting, entity references, and embedded elements.

### Design principles

1. **Typed items**: Each element in a rich text array has a `type` field discriminator
2. **Faceted formatting**: Within `textItem`, ATProto-style facets mark byte ranges for bold, italic, code, and LaTeX
3. **Entity references**: Inline references to knowledge graph nodes, Wikidata entities, eprints, and authors
4. **Plain text fallback**: All rich text fields have a companion plain text field for search indexing

### pub.chive.richtext.defs

Shared definitions for the unified rich text system. These types are referenced by `pub.chive.eprint.submission` and `pub.chive.review.comment`.

#### richText

The top-level rich text structure with both a plain text representation and an array of typed items.

```typescript
interface RichText {
  text: string; // Plain text for search/accessibility, max 100000 chars
  items: RichTextItem[]; // Array of typed items for rendering, max 10000
  html?: string; // Optional pre-rendered HTML, max 200000 chars
}
```

### Rich text item types

All rich text items share a common structure: a `type` discriminator field and type-specific properties.

#### textItem

Plain text content with optional ATProto-style facets for inline formatting.

```typescript
interface TextItem {
  type: 'text';
  content: string; // Text content, max 100000 chars / 50000 graphemes
  format?: TextFormat; // Optional formatting flags
}

interface TextFormat {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  code?: boolean; // Inline code
}
```

#### mentionItem

ATProto mention (@handle) for referencing users.

```typescript
interface MentionItem {
  type: 'mention';
  did: string; // User DID (required)
  handle?: string; // Handle for display
  displayName?: string; // Display name, max 256 chars / 64 graphemes
}
```

#### linkItem

URL hyperlink with optional display label.

```typescript
interface LinkItem {
  type: 'link';
  url: string; // URL (required)
  label?: string; // Display text, max 1000 chars / 500 graphemes
}
```

#### tagItem

Hashtag reference.

```typescript
interface TagItem {
  type: 'tag';
  tag: string; // Tag value without # prefix, max 256 chars / 64 graphemes
}
```

#### nodeRefItem

Reference to a knowledge graph node. Used for linking to fields, institutions, concepts, or other graph entities.

```typescript
interface NodeRefItem {
  type: 'nodeRef';
  uri: string; // AT-URI of the node (required)
  label: string; // Display label (required), max 256 chars / 64 graphemes
  subkind?: string; // Node subkind for styling (field, institution, person, etc.)
}
```

#### wikidataRefItem

Reference to a Wikidata entity for linking to external knowledge bases.

```typescript
interface WikidataRefItem {
  type: 'wikidataRef';
  qid: string; // Wikidata QID, e.g., "Q123456" (required)
  label: string; // Display label (required), max 256 chars / 64 graphemes
  url?: string; // Optional direct URL override
}
```

#### fieldRefItem

Reference to an academic field node. Specialized form of nodeRefItem for field classification.

```typescript
interface FieldRefItem {
  type: 'fieldRef';
  uri: string; // AT-URI of field node (required)
  label: string; // Display label (required), max 256 chars / 64 graphemes
}
```

#### facetRefItem

Reference to a facet classification node (PMEST framework dimensions).

```typescript
interface FacetRefItem {
  type: 'facetRef';
  dimension: string; // Facet dimension (e.g., "time", "space"), max 64 chars
  value: string; // Facet value, max 256 chars / 64 graphemes
}
```

#### eprintRefItem

Reference to another eprint for cross-referencing related work.

```typescript
interface EprintRefItem {
  type: 'eprintRef';
  uri: string; // AT-URI of the eprint (required)
  title: string; // Eprint title (required), max 1000 chars / 300 graphemes
}
```

#### annotationRefItem

Reference to an annotation or review comment.

```typescript
interface AnnotationRefItem {
  type: 'annotationRef';
  uri: string; // AT-URI of the annotation (required)
  excerpt: string; // Text excerpt for preview (required), max 500 chars / 200 graphemes
}
```

#### authorRefItem

Reference to an author by their DID.

```typescript
interface AuthorRefItem {
  type: 'authorRef';
  did: string; // Author DID (required)
  displayName?: string; // Display name, max 256 chars / 64 graphemes
  handle?: string; // Author handle
}
```

#### latexItem

LaTeX math expression for inline or display math.

```typescript
interface LatexItem {
  type: 'latex';
  content: string; // LaTeX source (required), max 10000 chars
  displayMode: boolean; // true for display/block ($$...$$), false for inline ($...$)
}
```

#### codeItem

Code content, either inline or as a block.

```typescript
interface CodeItem {
  type: 'code';
  content: string; // Code content (required), max 50000 chars
  language?: string; // Programming language for syntax highlighting, max 50 chars
  block?: boolean; // true for code block, false for inline code
}
```

### Block-level items

These item types create block-level structure within abstracts and comments.

#### headingItem

Section heading for structured documents.

```typescript
interface HeadingItem {
  type: 'heading';
  content: string; // Heading text (required), max 500 chars
  level: number; // Heading level 1-6 (required)
}
```

#### listItem

List item for bullet or ordered lists.

```typescript
interface ListItem {
  type: 'listItem';
  content: string; // Item text (required), max 2000 chars
  listType: string; // "bullet" or "ordered" (required)
  depth?: number; // Nesting depth 0-5
  ordinal?: number; // Number for ordered lists (1+)
}
```

#### blockquoteItem

Block quotation.

```typescript
interface BlockquoteItem {
  type: 'blockquote';
  content: string; // Quoted text (required), max 5000 chars
}
```

#### codeBlockItem

Fenced code block with optional language hint.

```typescript
interface CodeBlockItem {
  type: 'codeBlock';
  content: string; // Code content (required), max 50000 chars
  language?: string; // Language for syntax highlighting, max 50 chars
}
```

### Facet system

Within `textItem`, ATProto-style facets apply formatting to byte ranges. Facets use byte positions (not character positions) for correct Unicode handling.

#### byteSlice

Byte range for facet positioning.

```typescript
interface ByteSlice {
  byteStart: number; // Start byte position, inclusive (0+)
  byteEnd: number; // End byte position, exclusive (0+)
}
```

#### Facet features

Each facet contains an index (byte range) and an array of features to apply.

```typescript
interface Facet {
  index: ByteSlice;
  features: FacetFeature[];
}

// Facet feature types
interface BoldFacet {
  $type: 'pub.chive.richtext.facets#bold';
}

interface ItalicFacet {
  $type: 'pub.chive.richtext.facets#italic';
}

interface StrikethroughFacet {
  $type: 'pub.chive.richtext.facets#strikethrough';
}

interface CodeFacet {
  $type: 'pub.chive.richtext.facets#code';
}

interface LatexFacet {
  $type: 'pub.chive.richtext.facets#latex';
  displayMode: boolean; // true for display mode, false for inline
}

interface LinkFacet {
  $type: 'app.bsky.richtext.facet#link'; // Reuses Bluesky's link facet
  uri: string;
}
```

### Rich text usage by lexicon

| Lexicon                       | Field       | Allowed item types                                                                          |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `pub.chive.eprint.submission` | `titleRich` | textItem, nodeRefItem, wikidataRefItem, fieldRefItem, latexItem, mentionItem, linkItem      |
| `pub.chive.eprint.submission` | `abstract`  | All item types including block-level (headingItem, listItem, blockquoteItem, codeBlockItem) |
| `pub.chive.review.comment`    | `body`      | All item types including block-level                                                        |

## Eprint lexicons

### pub.chive.eprint.submission

Core eprint record with rich text support for titles and abstracts.

```typescript
{
  "$type": "pub.chive.eprint.submission",
  "title": string,              // Required, plain text title, max 500 chars
  "titleRich": TitleRichItem[], // Optional, rich title with LaTeX/refs, max 50 items
  "abstract": AbstractItem[],   // Required, rich abstract, max 500 items
  "abstractPlainText": string,  // Auto-generated for search indexing, max 10000 chars
  "document": BlobRef,          // Required, manuscript (PDF, DOCX, LaTeX, etc.)
  "documentFormatSlug": string, // Detected format (pdf, docx, latex, etc.)
  "authors": AuthorContribution[], // Required, 1-100 authors
  "submittedBy": string,        // Required, DID of submitter
  "paperDid": string,           // Optional, DID of paper account (paper-centric model)
  "licenseSlug": string,        // Required, SPDX identifier
  "keywords": string[],         // Optional, max 20 keywords
  "fieldUris": string[],        // Optional, AT-URIs to field nodes, max 10
  "topicUris": string[],        // Optional, AT-URIs to topic nodes, max 20
  "facetUris": string[],        // Optional, AT-URIs to facet nodes, max 30
  "supplementaryMaterials": SupplementaryItem[], // Optional, max 50
  "version": SemanticVersion,   // Semantic version object
  "previousVersion": string,    // AT-URI to previous version
  "createdAt": string           // Required, ISO 8601
}
```

**Title rich text types:**

The `titleRich` field accepts a subset of rich text items suitable for titles:

- `textItem`: Plain text with facets
- `nodeRefItem`: Knowledge graph node reference
- `wikidataRefItem`: Wikidata entity reference
- `fieldRefItem`: Academic field reference
- `latexItem`: Math expressions (common in scientific titles)
- `mentionItem`: User mention
- `linkItem`: URL hyperlink

**Abstract rich text types:**

The `abstract` field accepts all rich text item types:

- All title types plus:
- `facetRefItem`: Facet classification reference
- `eprintRefItem`: Cross-reference to another eprint
- `annotationRefItem`: Reference to an annotation
- `authorRefItem`: Author reference
- `tagItem`: Hashtag
- `codeBlockItem`: Fenced code blocks
- `headingItem`: Section headings
- `listItem`: Bullet/ordered list items
- `blockquoteItem`: Block quotations

**SemanticVersion type:**

```typescript
interface SemanticVersion {
  major: number; // Major version (1+), fundamental revisions
  minor: number; // Minor version (0+), new content/additions
  patch: number; // Patch version (0+), corrections/fixes
  prerelease?: string; // Optional prerelease tag (e.g., "draft", "rc1")
}
```

See `lexicons/pub/chive/eprint/submission.json` for the complete schema.

### pub.chive.eprint.changelog

Structured changelog entry for eprint version updates.

```typescript
{
  "$type": "pub.chive.eprint.changelog",
  "eprintUri": string,          // Required, AT-URI of the eprint
  "version": SemanticVersion,   // Required, version this changelog describes
  "previousVersion": SemanticVersion, // Optional, previous version
  "summary": string,            // Optional, one-line summary, max 500 chars
  "sections": ChangelogSection[], // Required, structured changes, max 20
  "reviewerResponse": string,   // Optional, response to peer review, max 10000 chars
  "createdAt": string           // Required, ISO 8601
}
```

**ChangelogSection type:**

```typescript
interface ChangelogSection {
  category: string; // Category (kebab-case)
  items: ChangeItem[]; // Change items, max 50
}

interface ChangeItem {
  description: string; // Required, max 2000 chars
  changeType?: string; // "added" | "changed" | "removed" | "fixed" | "deprecated"
  location?: string; // Document location, max 100 chars
  reviewReference?: string; // Reviewer comment reference, max 200 chars
}
```

**Changelog categories:**

| Category                  | Description                 |
| ------------------------- | --------------------------- |
| `methodology`             | Changes to research methods |
| `results`                 | New or updated results      |
| `analysis`                | Data analysis changes       |
| `discussion`              | Discussion section updates  |
| `conclusions`             | Conclusion changes          |
| `data`                    | Data updates or corrections |
| `figures`                 | Figure changes              |
| `tables`                  | Table changes               |
| `references`              | Bibliography updates        |
| `supplementary-materials` | Supplementary file updates  |
| `corrections`             | Error corrections           |
| `formatting`              | Layout/formatting changes   |
| `language-editing`        | Grammar/style improvements  |
| `acknowledgments`         | Acknowledgment updates      |
| `authorship`              | Author list changes         |
| `other`                   | Other changes               |

### pub.chive.eprint.userTag

User-contributed tag on an eprint.

```typescript
{
  "$type": "pub.chive.eprint.userTag",
  "subject": StrongRef,         // Reference to eprint
  "tag": string,                // Tag text, max 50 chars
  "createdAt": string
}
```

## Eprint procedures

### pub.chive.eprint.updateSubmission

Authorize and prepare an eprint update.

```typescript
// Input
{
  "uri": string,                // Required, AT-URI of eprint
  "versionBump": string,        // Required, "major" | "minor" | "patch"
  "title": string,              // Optional, updated title
  "abstract": RichAbstract[],   // Optional, updated abstract
  "document": BlobRef,          // Optional, replacement document
  "keywords": string[],         // Optional, updated keywords
  "fieldUris": string[],        // Optional, updated field references
  "changelog": ChangelogInput   // Optional, structured changelog
}

// Output
{
  "uri": string,                // AT-URI of the eprint
  "version": SemanticVersion,   // New semantic version
  "expectedCid": string,        // CID for optimistic concurrency control
  "changelogUri": string        // Optional, AT-URI of created changelog record
}
```

The frontend uses `expectedCid` as the `swapRecord` parameter when calling `putRecord` to prevent race conditions.

### pub.chive.eprint.deleteSubmission

Authorize an eprint deletion.

```typescript
// Input
{
  "uri": string                 // Required, AT-URI of eprint to delete
}

// Output
{
  "success": boolean            // Whether deletion is authorized
}
```

## Review lexicons

### pub.chive.review.comment

Review comment with rich text body supporting formatting, entity references, and structured content.

```typescript
{
  "$type": "pub.chive.review.comment",
  "eprintUri": string,          // Required, AT-URI of reviewed eprint
  "body": BodyItem[],           // Required, rich text body, max 500 items
  "target": TextSpanTarget,     // Optional, target span for inline annotations
  "motivationUri": string,      // Optional, AT-URI of motivation type node
  "motivationFallback": string, // Optional, fallback motivation
  "parentComment": string,      // Optional, AT-URI for threading
  "createdAt": string           // Required, ISO 8601
}
```

**Body item types:**

The `body` field accepts all rich text item types:

- `textItem`: Plain text with optional facets
- `nodeRefItem`: Knowledge graph node reference
- `wikidataRefItem`: Wikidata entity reference
- `fieldRefItem`: Academic field reference
- `facetRefItem`: Facet classification reference
- `eprintRefItem`: Cross-reference to another eprint
- `annotationRefItem`: Reference to an annotation
- `authorRefItem`: Author reference by DID
- `mentionItem`: ATProto @mention
- `linkItem`: URL hyperlink
- `tagItem`: Hashtag
- `latexItem`: LaTeX math expression
- `codeBlockItem`: Fenced code block
- `headingItem`: Section heading
- `listItem`: List item
- `blockquoteItem`: Block quotation

**TextSpanTarget type:**

For inline annotations targeting specific text in the eprint. Implements W3C Web Annotation selectors.

```typescript
interface TextSpanTarget {
  versionUri?: string; // AT-URI of specific eprint version
  selector: TextQuoteSelector | TextPositionSelector | FragmentSelector;
}

interface TextQuoteSelector {
  type: 'TextQuoteSelector';
  exact: string; // Exact text to match, max 1000 chars
  prefix?: string; // Context before, max 100 chars
  suffix?: string; // Context after, max 100 chars
}

interface TextPositionSelector {
  type: 'TextPositionSelector';
  start: number; // Start character position (0+)
  end: number; // End character position (0+)
}

interface FragmentSelector {
  type: 'FragmentSelector';
  value: string; // Fragment identifier (page, section), max 200 chars
  conformsTo?: string; // Fragment syntax spec URI
}
```

**Motivation values:**

| Value          | Description                 |
| -------------- | --------------------------- |
| `commenting`   | General comment             |
| `questioning`  | Raising a question          |
| `highlighting` | Highlighting important text |
| `replying`     | Reply to another comment    |
| `linking`      | Providing a reference link  |

### pub.chive.review.endorsement

Endorsement of contribution types in an eprint.

```typescript
{
  "$type": "pub.chive.review.endorsement",
  "eprintUri": string,            // Required, AT-URI of eprint being endorsed
  "contributions": string[],      // Required, 1-15 contribution types (no duplicates)
  "comment": string,              // Optional, max 5000 chars
  "createdAt": string             // Required, ISO 8601
}
```

**Contribution types** (based on CRediT taxonomy):

| Value               | Description              |
| ------------------- | ------------------------ |
| `methodological`    | Sound methodology        |
| `analytical`        | Analytical rigor         |
| `theoretical`       | Theoretical framework    |
| `empirical`         | Empirical approach       |
| `conceptual`        | Conceptualization        |
| `technical`         | Technical implementation |
| `data`              | Data quality/curation    |
| `replication`       | Replication study        |
| `reproducibility`   | Reproducible results     |
| `synthesis`         | Literature synthesis     |
| `interdisciplinary` | Cross-disciplinary work  |
| `pedagogical`       | Educational value        |
| `visualization`     | Data visualization       |
| `societal-impact`   | Societal relevance       |
| `clinical`          | Clinical applicability   |

## Graph lexicons

### pub.chive.graph.node

Node record for the knowledge graph.

```typescript
{
  "$type": "pub.chive.graph.node",
  "id": string,                 // Unique identifier
  "kind": "type" | "object",    // Node classification
  "subkind": string,            // "field", "facet", "institution", "person", "concept"
  "label": string,              // Display name
  "alternateLabels": string[],  // Synonyms (max 20)
  "description": string,        // Scope note (max 2000 chars)
  "externalIds": ExternalId[],  // Links to Wikidata, LCSH, etc.
  "status": NodeStatus,
  "createdAt": string,
  "updatedAt": string
}

type NodeStatus = "proposed" | "provisional" | "established" | "deprecated";

interface ExternalId {
  source: string;               // "wikidata", "lcsh", "viaf", "fast", "orcid", "ror"
  value: string;                // The external identifier
}
```

### pub.chive.graph.edge

Relationship between two nodes in the knowledge graph.

```typescript
{
  "$type": "pub.chive.graph.edge",
  "sourceUri": string,          // AT URI of source node
  "targetUri": string,          // AT URI of target node
  "relationSlug": EdgeRelation, // Relationship type
  "weight": number,             // Relationship strength (0.0-1.0)
  "status": EdgeStatus,
  "createdAt": string
}

type EdgeRelation = "broader" | "narrower" | "related" | "sameAs" | "partOf" | "hasPart";
type EdgeStatus = "proposed" | "established" | "deprecated";
```

### pub.chive.graph.nodeProposal

Proposal to create, update, merge, or deprecate a node.

```typescript
{
  "$type": "pub.chive.graph.nodeProposal",
  "proposalType": ProposalType,
  "kind": "type" | "object",
  "subkind": string,
  "proposedNode": ProposedNodeData,
  "rationale": string,          // Max 2000 chars
  "evidence": Evidence[],       // Supporting materials
  "createdAt": string
}

type ProposalType = "create" | "update" | "merge" | "deprecate";

interface ProposedNodeData {
  id?: string;                  // Required for update/merge/deprecate
  label?: string;
  alternateLabels?: string[];
  description?: string;
  externalIds?: ExternalId[];
  mergeIntoUri?: string;        // For merge proposals
  deprecationReason?: string;   // For deprecate proposals
}

interface Evidence {
  type: string;                 // "publication_count", "conference", "expert_endorsement"
  source?: string;
  value?: string | number;
  url?: string;
}
```

### pub.chive.graph.edgeProposal

Proposal to create, update, or deprecate an edge between nodes.

```typescript
{
  "$type": "pub.chive.graph.edgeProposal",
  "proposalType": "create" | "update" | "deprecate",
  "proposedEdge": ProposedEdgeData,
  "rationale": string,          // Max 2000 chars
  "createdAt": string
}

interface ProposedEdgeData {
  sourceUri: string;
  targetUri: string;
  relationSlug: EdgeRelation;
  weight?: number;
}
```

### pub.chive.graph.vote

Vote on a proposal.

```typescript
{
  "$type": "pub.chive.graph.vote",
  "proposal": StrongRef,        // Reference to proposal
  "vote": "approve" | "reject" | "abstain",
  "comment": string,            // Optional, max 500 chars
  "createdAt": string
}
```

## Actor lexicons

### pub.chive.actor.profile

Extended user profile.

```typescript
{
  "$type": "pub.chive.actor.profile",
  "bio": string,                // Max 1000 chars
  "orcid": string,              // ORCID iD
  "affiliation": string,
  "website": string,
  "researchInterests": string[],
  "fields": string[],           // Followed fields
  "publicEmail": string
}
```

### pub.chive.discovery.settings

Discovery preferences for personalized recommendations.

```typescript
{
  "$type": "pub.chive.discovery.settings",
  "enablePersonalization": boolean,
  "enableForYouFeed": boolean,
  "forYouSignals": {
    "fields": boolean,
    "citations": boolean,
    "collaborators": boolean,
    "trending": boolean
  },
  "relatedPapersSignals": {
    "citations": boolean,
    "topics": boolean
  },
  "citationNetworkDisplay": "hidden" | "preview" | "expanded",
  "showRecommendationReasons": boolean
}
```

## Common types

### StrongRef

Reference to another record.

```typescript
interface StrongRef {
  uri: string; // AT URI
  cid: string; // Content ID
}
```

### BlobRef

Reference to a blob.

```typescript
interface BlobRef {
  $type: 'blob';
  ref: {
    $link: string; // CID
  };
  mimeType: string;
  size: number;
}
```

## Validation rules

### String limits

| Field               | Max length |
| ------------------- | ---------- |
| Title               | 500        |
| Abstract plain text | 10000      |
| Comment body items  | 500        |
| Tag                 | 50         |
| Bio                 | 1000       |
| LaTeX content       | 10000      |
| Code block content  | 50000      |

### Array limits

| Field               | Max items |
| ------------------- | --------- |
| Authors             | 100       |
| Keywords            | 20        |
| Field URIs          | 10        |
| Topic URIs          | 20        |
| Facet URIs          | 30        |
| Title rich items    | 50        |
| Abstract items      | 500       |
| Comment body items  | 500       |
| Supplementary items | 50        |
| Alternate labels    | 20        |
| Facets per text     | 500       |
| Rich text items     | 10000     |

### Blob limits

| Type             | Max size   |
| ---------------- | ---------- |
| PDF              | 100 MB     |
| Supplementary    | 50 MB each |
| Total per record | 200 MB     |

## Versioning

Lexicons follow semantic versioning:

- **Major**: Breaking changes (new required fields, removed fields)
- **Minor**: Backwards-compatible additions (new optional fields)
- **Patch**: Bug fixes, documentation updates

Current versions:

| Lexicon                | Version |
| ---------------------- | ------- |
| `pub.chive.eprint.*`   | 1.0.0   |
| `pub.chive.review.*`   | 1.0.0   |
| `pub.chive.graph.*`    | 1.0.0   |
| `pub.chive.actor.*`    | 1.0.0   |
| `pub.chive.richtext.*` | 1.0.0   |

## Related documentation

- [AT Protocol Concepts](../concepts/at-protocol.md): Protocol fundamentals
- [API Reference](../api-reference/xrpc-endpoints.md): XRPC endpoints
- [Data Sovereignty](../concepts/data-sovereignty.md): Where data lives
