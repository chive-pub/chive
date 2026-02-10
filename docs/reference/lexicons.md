# Lexicons reference

Chive uses the `pub.chive.*` namespace for all AT Protocol lexicons. These lexicons define 17 record types, 81 queries, and 32 procedures across 20 namespaces. All records are stored in user-controlled PDSes and indexed by the Chive AppView via the ATProto firehose.

For the ATProto lexicon specification, see the [Lexicon Guide](https://atproto.com/guides/lexicon).

## Namespace overview

| Namespace                  | Purpose                                      |
| -------------------------- | -------------------------------------------- |
| `pub.chive.activity.*`     | Activity feed and correlation metrics        |
| `pub.chive.actor.*`        | User profiles and autocomplete               |
| `pub.chive.alpha.*`        | Alpha program enrollment                     |
| `pub.chive.annotation.*`   | Inline text annotations and entity links     |
| `pub.chive.author.*`       | Author profiles and search                   |
| `pub.chive.backlink.*`     | Cross-reference backlinks                    |
| `pub.chive.claiming.*`     | Eprint ownership claiming and coauthorship   |
| `pub.chive.defs`           | Shared enum definitions                      |
| `pub.chive.discovery.*`    | Recommendations and citation networks        |
| `pub.chive.endorsement.*`  | Endorsement aggregation queries              |
| `pub.chive.eprint.*`       | Eprint submissions, versions, and changelogs |
| `pub.chive.governance.*`   | Community governance and editor management   |
| `pub.chive.graph.*`        | Knowledge graph nodes, edges, and proposals  |
| `pub.chive.import.*`       | External eprint import                       |
| `pub.chive.metrics.*`      | View counts, downloads, and trending         |
| `pub.chive.notification.*` | Review and endorsement notifications         |
| `pub.chive.review.*`       | Document-level reviews and entity links      |
| `pub.chive.richtext.*`     | Shared rich text definitions and facets      |
| `pub.chive.sync.*`         | PDS synchronization and staleness checking   |
| `pub.chive.tag.*`          | User-generated tags and tag search           |

## Shared definitions (pub.chive.defs)

Reusable enum types referenced by multiple lexicons. All use `knownValues` (open enums) for forward compatibility.

### documentFormat

Document format slug for uploaded manuscripts.

```typescript
type DocumentFormat =
  | 'pdf'
  | 'docx'
  | 'html'
  | 'markdown'
  | 'latex'
  | 'jupyter'
  | 'odt'
  | 'rtf'
  | 'epub'
  | 'txt'
  | (string & {});
```

### publicationStatus

Publication lifecycle stage.

```typescript
type PublicationStatus =
  | 'eprint'
  | 'preprint'
  | 'under_review'
  | 'revision_requested'
  | 'accepted'
  | 'in_press'
  | 'published'
  | 'retracted'
  | 'withdrawn'
  | (string & {});
```

### supplementaryCategory

Category for supplementary materials.

```typescript
type SupplementaryCategory =
  | 'appendix'
  | 'figure'
  | 'table'
  | 'dataset'
  | 'code'
  | 'notebook'
  | 'video'
  | 'audio'
  | 'presentation'
  | 'protocol'
  | 'questionnaire'
  | 'other'
  | (string & {});
```

## Rich text system

Chive uses a unified rich text system for titles, abstracts, review comments, and annotation bodies. Rich text is represented as arrays of typed items, enabling structured content with formatting, entity references, and embedded elements.

### Design principles

1. **Typed items**: Each element in a rich text array has a `type` field discriminator
2. **Faceted formatting**: Within `textItem`, ATProto-style facets mark byte ranges for bold, italic, code, and LaTeX
3. **Entity references**: Inline references to knowledge graph nodes, Wikidata entities, eprints, and authors
4. **Plain text fallback**: All rich text fields have a companion plain text field for search indexing

### pub.chive.richtext.defs

Shared definitions for the unified rich text system. These types are referenced by `pub.chive.eprint.submission`, `pub.chive.review.comment`, and `pub.chive.annotation.comment`.

#### richText

The top-level rich text structure with both a plain text representation and an array of typed items.

```typescript
interface RichText {
  text: string; // Plain text for search/accessibility, max 100000 chars
  items: RichTextItem[]; // Array of typed items for rendering, max 10000
  html?: string; // Optional pre-rendered HTML, max 200000 chars
}
```

### pub.chive.richtext.facets

Facet feature types for byte-range formatting within `textItem` content. Facets use byte positions (not character positions) for correct Unicode handling.

#### Bold, Italic, Strikethrough, Code

Marker-only facets with no additional properties.

```typescript
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
```

#### Latex facet

```typescript
interface LatexFacet {
  $type: 'pub.chive.richtext.facets#latex';
  displayMode: boolean; // true for display mode ($$...$$), false for inline ($...$)
}
```

#### Heading facet

```typescript
interface HeadingFacet {
  $type: 'pub.chive.richtext.facets#heading';
  level: number; // 1 to 6
}
```

#### Blockquote facet

```typescript
interface BlockquoteFacet {
  $type: 'pub.chive.richtext.facets#blockquote';
}
```

#### CodeBlock facet

```typescript
interface CodeBlockFacet {
  $type: 'pub.chive.richtext.facets#codeBlock';
  language?: string; // programming language for syntax highlighting
}
```

#### ListItem facet

```typescript
interface ListItemFacet {
  $type: 'pub.chive.richtext.facets#listItem';
  listType: 'bullet' | 'ordered' | (string & {});
  depth?: number; // nesting depth, 0-indexed
  ordinal?: number; // item number for ordered lists
}
```

#### Link facet

Reuses the Bluesky link facet type.

```typescript
interface LinkFacet {
  $type: 'app.bsky.richtext.facet#link';
  uri: string;
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

Code content, either inline or as a block. Defined in `pub.chive.richtext.defs`.

```typescript
interface CodeItem {
  type: 'code';
  content: string; // Code content (required), max 50000 chars
  language?: string; // Programming language for syntax highlighting, max 50 chars
  block?: boolean; // true for code block, false for inline code
}
```

### Block-level items

These item types create block-level structure within abstracts, reviews, and annotations.

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

Fenced code block with optional language hint. Used in review and annotation bodies (distinct from `codeItem` in `richtext.defs`).

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

#### Facet structure

Each facet contains an index (byte range) and an array of features to apply.

```typescript
interface Facet {
  index: ByteSlice;
  features: FacetFeature[];
}
```

Supported facet features: `bold`, `italic`, `strikethrough`, `code`, `latex`, `link`, `heading`, `blockquote`, `codeBlock`, `listItem`.

### Rich text usage by lexicon

| Lexicon                        | Field       | Allowed item types                                                                          |
| ------------------------------ | ----------- | ------------------------------------------------------------------------------------------- |
| `pub.chive.eprint.submission`  | `titleRich` | textItem, nodeRefItem, wikidataRefItem, fieldRefItem, latexItem, mentionItem, linkItem      |
| `pub.chive.eprint.submission`  | `abstract`  | All item types including block-level (headingItem, listItem, blockquoteItem, codeBlockItem) |
| `pub.chive.review.comment`     | `body`      | All 16 item types including block-level                                                     |
| `pub.chive.annotation.comment` | `body`      | All 16 item types including block-level                                                     |

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

### pub.chive.eprint.version

Version metadata record linking an eprint to its version history.

```typescript
{
  "$type": "pub.chive.eprint.version",
  "eprintUri": string,           // Required, AT-URI of the eprint
  "versionNumber": number,       // Required, integer >= 1
  "previousVersionUri": string,  // Optional, AT-URI of previous version record
  "changes": string,             // Required, description of changes, max 2000 chars
  "createdAt": string            // Required, ISO 8601
}
```

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

### Eprint queries and procedures

| Lexicon                              | Type      | Description                            |
| ------------------------------------ | --------- | -------------------------------------- |
| `pub.chive.eprint.getSubmission`     | Query     | Get a single eprint by URI             |
| `pub.chive.eprint.searchSubmissions` | Query     | Full-text search across eprints        |
| `pub.chive.eprint.listByAuthor`      | Query     | List eprints by a specific author DID  |
| `pub.chive.eprint.getChangelog`      | Query     | Get a single changelog entry           |
| `pub.chive.eprint.listChangelogs`    | Query     | List changelogs for an eprint          |
| `pub.chive.eprint.updateSubmission`  | Procedure | Authorize and prepare an eprint update |
| `pub.chive.eprint.deleteSubmission`  | Procedure | Authorize an eprint deletion           |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Annotation lexicons

Annotations target specific text spans within eprint documents. They implement [W3C Web Annotation](https://www.w3.org/TR/annotation-model/) selectors for text targeting with ATProto-native storage.

### pub.chive.annotation.comment

Inline annotation on a specific text span in an eprint. For document-level comments, use `pub.chive.review.comment` instead.

```typescript
{
  "$type": "pub.chive.annotation.comment",
  "eprintUri": string,          // Required, AT-URI of annotated eprint
  "body": BodyItem[],           // Required, rich text body, max 500 items
  "target": TextSpanTarget,     // Required, targeted text span
  "motivationUri": string,      // Optional, AT-URI of motivation type node
  "motivationFallback": string, // Optional, fallback motivation
  "parentAnnotation": string,   // Optional, AT-URI for threading
  "createdAt": string           // Required, ISO 8601
}
```

**Body item types (16 union refs):**

textItem, nodeRefItem, wikidataRefItem, fieldRefItem, facetRefItem, eprintRefItem, annotationRefItem, authorRefItem, mentionItem, linkItem, tagItem, latexItem, codeBlockItem, headingItem, listItem, blockquoteItem.

**Motivation values** (knownValues, open enum):

| Value          | Description                 |
| -------------- | --------------------------- |
| `commenting`   | General comment             |
| `questioning`  | Raising a question          |
| `highlighting` | Highlighting important text |
| `replying`     | Reply to another annotation |

#### TextSpanTarget type

Implements W3C Web Annotation selectors for targeting text spans.

```typescript
interface TextSpanTarget {
  versionUri?: string; // AT-URI of specific eprint version
  selector: TextQuoteSelector | TextPositionSelector | FragmentSelector;
  refinedBy?: PositionRefinement;
}
```

**Selector types:**

```typescript
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

**PositionRefinement type:**

Provides precise visual rendering coordinates for PDF annotations.

```typescript
interface PositionRefinement {
  type: 'TextPositionSelector';
  pageNumber?: number; // 0-indexed page number
  start?: number; // Approximate character start offset
  end?: number; // Approximate character end offset
  boundingRect?: BoundingRect;
}

interface BoundingRect {
  x1: string; // Left edge (string for float precision)
  y1: string; // Top edge
  x2: string; // Right edge
  y2: string; // Bottom edge
  width: string; // Page width reference
  height: string; // Page height reference
  pageNumber: number; // 1-indexed page number
}
```

All `BoundingRect` coordinate values are stored as strings because ATProto only supports integer types; string encoding preserves floating-point precision.

### pub.chive.annotation.entityLink

Link from a text span to a knowledge graph entity. Connects mentions of entities in eprint text to structured knowledge representations.

```typescript
{
  "$type": "pub.chive.annotation.entityLink",
  "eprintUri": string,          // Required, AT-URI of the eprint
  "target": TextSpanTarget,     // Required, targeted text span with source
  "linkedEntity": LinkedEntity, // Required, union of entity link types
  "confidence": number,         // Optional, 0 to 1000 (scaled 0.0 to 1.0)
  "createdAt": string           // Required, ISO 8601
}
```

**TextSpanTarget for entityLink:**

The entityLink target structure differs from annotation.comment. It includes a `source` field and uses only `TextQuoteSelector` with an optional `TextPositionSelector` refinement.

```typescript
interface TextSpanTarget {
  source: string; // AT-URI of the source document
  selector: TextQuoteSelector; // TextQuoteSelector only
  refinedBy?: TextPositionSelector; // Optional position refinement with pageNumber
}

interface TextPositionSelector {
  type: 'TextPositionSelector';
  start: number; // Start character offset
  end: number; // End character offset
  pageNumber: number; // 0-indexed page number in the document
  boundingRect?: BoundingRect; // Visual positioning coordinates
}
```

**LinkedEntity union types:**

```typescript
// link to a knowledge graph node
interface GraphNodeLink {
  type: 'graphNode';
  uri: string; // AT-URI of the graph node (required)
  label: string; // Display label (required)
  kind: 'type' | 'object' | (string & {}); // Node classification (required)
  id?: string; // Node UUID
  slug?: string; // Human-readable slug (e.g., "computer-science")
  subkind?: string; // Subkind slug (e.g., "field", "facet", "institution")
  subkindUri?: string; // AT-URI of the subkind type node
}

// link to an external identifier system
interface ExternalIdLink {
  type: 'externalId';
  system: ExternalIdSystem; // Identifier system (required)
  identifier: string; // Identifier value, e.g., "Q42" for Wikidata (required)
  label: string; // Display label (required)
  uri?: string; // Full URI for the external entity
}

// link to an ATProto author
interface AuthorLink {
  type: 'author';
  did: string; // Author DID (required)
  displayName: string; // Display name (required)
  handle?: string; // Author handle
  orcid?: string; // ORCID iD
}

// link to another eprint
interface EprintLink {
  type: 'eprint';
  uri: string; // AT-URI of the eprint (required)
  title: string; // Eprint title (required)
  doi?: string; // DOI if available
}
```

**External identifier systems** (knownValues):

`wikidata`, `ror`, `orcid`, `isni`, `viaf`, `lcsh`, `fast`, `credit`, `spdx`, `fundref`, `mesh`, `aat`, `gnd`, `anzsrc`, `arxiv`, `doi`, `pmid`, `pmcid`

### Annotation queries

| Lexicon                              | Type  | Description                                            |
| ------------------------------------ | ----- | ------------------------------------------------------ |
| `pub.chive.annotation.listForEprint` | Query | List annotations for an eprint with optional filtering |
| `pub.chive.annotation.listForPage`   | Query | List annotations for a specific PDF page               |
| `pub.chive.annotation.getThread`     | Query | Get annotation thread with all replies                 |
| `pub.chive.annotation.listByAuthor`  | Query | List annotations by a specific author                  |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Review lexicons

Reviews are document-level comments on eprints. For inline text annotations targeting specific spans, use `pub.chive.annotation.comment`.

### pub.chive.review.comment

Document-level review comment with rich text body supporting formatting, entity references, and structured content. The `target` field is optional; when omitted, the review applies to the eprint as a whole.

```typescript
{
  "$type": "pub.chive.review.comment",
  "eprintUri": string,          // Required, AT-URI of reviewed eprint
  "body": BodyItem[],           // Required, rich text body, max 500 items
  "target": TextSpanTarget,     // Optional, target span for inline reviews
  "motivationUri": string,      // Optional, AT-URI of motivation type node
  "motivationFallback": string, // Optional, fallback motivation
  "parentComment": string,      // Optional, AT-URI for threading
  "createdAt": string           // Required, ISO 8601
}
```

**Body item types:**

The `body` field accepts all 16 rich text item types:

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

Same structure as `pub.chive.annotation.comment#textSpanTarget` (union of three selector types with optional position refinement). See the [annotation.comment TextSpanTarget](#textspantarget-type) for details.

**Motivation values** (knownValues, open enum):

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

### pub.chive.review.entityLink

Link from a text span to a knowledge graph entity, within the review namespace. Structurally identical to `pub.chive.annotation.entityLink`.

```typescript
{
  "$type": "pub.chive.review.entityLink",
  "eprintUri": string,          // Required, AT-URI of the eprint
  "target": TextSpanTarget,     // Required, targeted text span with source
  "linkedEntity": LinkedEntity, // Required, union of entity link types
  "confidence": number,         // Optional, 0 to 1000 (scaled 0.0 to 1.0)
  "createdAt": string           // Required, ISO 8601
}
```

The `TextSpanTarget` and `LinkedEntity` union types use the same structure as `pub.chive.annotation.entityLink`. See the [annotation.entityLink](#pubchiveannotationentitylink) section for the full type definitions.

### Review queries

| Lexicon                          | Type  | Description                          |
| -------------------------------- | ----- | ------------------------------------ |
| `pub.chive.review.listForEprint` | Query | List reviews for an eprint           |
| `pub.chive.review.getThread`     | Query | Get a review thread with all replies |
| `pub.chive.review.listForAuthor` | Query | List reviews by a specific author    |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Endorsement lexicons

Endorsement queries aggregate data from `pub.chive.review.endorsement` records. There are no additional record types in this namespace.

### Endorsement queries

| Lexicon                                     | Type  | Description                                      |
| ------------------------------------------- | ----- | ------------------------------------------------ |
| `pub.chive.endorsement.getSummary`          | Query | Get endorsement summary counts for an eprint     |
| `pub.chive.endorsement.listForEprint`       | Query | List all endorsements for an eprint              |
| `pub.chive.endorsement.getUserEndorsement`  | Query | Get the current user's endorsement for an eprint |
| `pub.chive.endorsement.listForUser`         | Query | List all endorsements by a user                  |
| `pub.chive.endorsement.listForAuthorPapers` | Query | List endorsements across an author's papers      |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

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
  "sourceUri": string,          // AT-URI of source node
  "targetUri": string,          // AT-URI of target node
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

### pub.chive.graph.reconciliation

Entity reconciliation record linking local knowledge graph entities to external authority systems.

```typescript
{
  "$type": "pub.chive.graph.reconciliation",
  "sourceUri": string,          // Required, AT-URI of local entity being reconciled
  "targetSystem": string,       // Required, external authority system
  "targetId": string,           // Required, identifier in the external system
  "confidence": number,         // Required, 0 to 1000 (scaled 0.0 to 1.0)
  "matchType": string,          // Optional, SKOS mapping type
  "status": string,             // Required, reconciliation status
  "verifiedBy": string,         // Optional, DID of user who verified the match
  "notes": string,              // Optional, max 1000 chars
  "createdAt": string,          // Required, ISO 8601
  "updatedAt": string           // Optional, ISO 8601
}
```

**Target systems** (knownValues):

`wikidata`, `lcsh`, `fast`, `ror`, `orcid`, `viaf`, `gnd`, `mesh`, `aat`, `getty`

**Match types** (knownValues, SKOS mapping vocabulary):

| Value     | Description                                            |
| --------- | ------------------------------------------------------ |
| `exact`   | Exact equivalence (skos:exactMatch)                    |
| `close`   | Close match, near-equivalence (skos:closeMatch)        |
| `broad`   | Local entity is narrower than target (skos:broadMatch) |
| `narrow`  | Local entity is broader than target (skos:narrowMatch) |
| `related` | Associative relationship (skos:relatedMatch)           |

**Status values** (knownValues):

| Value      | Description                   |
| ---------- | ----------------------------- |
| `proposed` | Awaiting verification         |
| `verified` | Confirmed by a trusted editor |
| `rejected` | Rejected as incorrect         |

### Graph queries

| Lexicon                          | Type  | Description                               |
| -------------------------------- | ----- | ----------------------------------------- |
| `pub.chive.graph.getNode`        | Query | Get a single node by URI                  |
| `pub.chive.graph.listNodes`      | Query | List nodes with optional filtering        |
| `pub.chive.graph.searchNodes`    | Query | Full-text search across nodes             |
| `pub.chive.graph.getEdge`        | Query | Get a single edge by URI                  |
| `pub.chive.graph.listEdges`      | Query | List edges for a node                     |
| `pub.chive.graph.getHierarchy`   | Query | Get the hierarchy tree for a node         |
| `pub.chive.graph.getRelations`   | Query | Get related nodes                         |
| `pub.chive.graph.getCommunities` | Query | Get community clusters in the graph       |
| `pub.chive.graph.getSubkinds`    | Query | List available subkind type nodes         |
| `pub.chive.graph.browseFaceted`  | Query | Browse nodes using faceted classification |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

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

### Actor queries

| Lexicon                                   | Type  | Description                                 |
| ----------------------------------------- | ----- | ------------------------------------------- |
| `pub.chive.actor.getMyProfile`            | Query | Get the authenticated user's profile        |
| `pub.chive.actor.getDiscoverySettings`    | Query | Get discovery preferences                   |
| `pub.chive.actor.autocompleteOrcid`       | Query | Autocomplete ORCID iDs                      |
| `pub.chive.actor.autocompleteAffiliation` | Query | Autocomplete institution affiliations       |
| `pub.chive.actor.autocompleteKeyword`     | Query | Autocomplete research keywords              |
| `pub.chive.actor.autocompleteOpenReview`  | Query | Autocomplete OpenReview profiles            |
| `pub.chive.actor.discoverAuthorIds`       | Query | Discover author identifiers from ORCID/name |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Author lexicons

Author queries provide read-only access to author profile data aggregated from the index.

### Author queries

| Lexicon                          | Type  | Description                     |
| -------------------------------- | ----- | ------------------------------- |
| `pub.chive.author.getProfile`    | Query | Get an author profile by DID    |
| `pub.chive.author.searchAuthors` | Query | Search authors by name or ORCID |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Tag lexicons

Tag queries provide search and discovery over user-generated tags from `pub.chive.eprint.userTag` records.

### Tag queries

| Lexicon                        | Type  | Description                       |
| ------------------------------ | ----- | --------------------------------- |
| `pub.chive.tag.search`         | Query | Search tags by prefix or keyword  |
| `pub.chive.tag.listForEprint`  | Query | List all tags for an eprint       |
| `pub.chive.tag.listEprints`    | Query | List eprints with a specific tag  |
| `pub.chive.tag.getDetail`      | Query | Get tag usage statistics          |
| `pub.chive.tag.getSuggestions` | Query | Get tag suggestions for an eprint |
| `pub.chive.tag.getTrending`    | Query | Get trending tags                 |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Sync lexicons

Sync endpoints manage PDS synchronization and staleness detection for the AppView index.

### Sync queries and procedures

| Lexicon                         | Type      | Description                             |
| ------------------------------- | --------- | --------------------------------------- |
| `pub.chive.sync.checkStaleness` | Query     | Check if an indexed record is stale     |
| `pub.chive.sync.verify`         | Query     | Verify record integrity against PDS     |
| `pub.chive.sync.refreshRecord`  | Procedure | Re-fetch and re-index a record from PDS |
| `pub.chive.sync.indexRecord`    | Procedure | Index a new record from PDS             |
| `pub.chive.sync.deleteRecord`   | Procedure | Remove an indexed record                |
| `pub.chive.sync.registerPDS`    | Procedure | Register a PDS for firehose consumption |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Notification lexicons

Notification queries return aggregated notifications for the authenticated user.

### Notification queries

| Lexicon                                             | Type  | Description                            |
| --------------------------------------------------- | ----- | -------------------------------------- |
| `pub.chive.notification.listReviewsOnMyPapers`      | Query | List reviews on the user's papers      |
| `pub.chive.notification.listEndorsementsOnMyPapers` | Query | List endorsements on the user's papers |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Activity lexicons

Activity endpoints provide feed data and correlation metrics for user activity.

### Activity queries and procedures

| Lexicon                                    | Type      | Description                          |
| ------------------------------------------ | --------- | ------------------------------------ |
| `pub.chive.activity.getFeed`               | Query     | Get the user's activity feed         |
| `pub.chive.activity.getCorrelationMetrics` | Query     | Get activity correlation metrics     |
| `pub.chive.activity.log`                   | Procedure | Log a user activity event            |
| `pub.chive.activity.markFailed`            | Procedure | Mark an activity log entry as failed |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Backlink lexicons

Backlinks track cross-references between eprints and external resources.

### Backlink queries and procedures

| Lexicon                        | Type      | Description                        |
| ------------------------------ | --------- | ---------------------------------- |
| `pub.chive.backlink.list`      | Query     | List backlinks for a resource      |
| `pub.chive.backlink.getCounts` | Query     | Get backlink counts for a resource |
| `pub.chive.backlink.create`    | Procedure | Create a backlink                  |
| `pub.chive.backlink.delete`    | Procedure | Delete a backlink                  |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Claiming lexicons

Claiming endpoints handle eprint ownership claims, coauthorship requests, and external import workflows.

### Claiming queries and procedures

| Lexicon                                     | Type      | Description                                        |
| ------------------------------------------- | --------- | -------------------------------------------------- |
| `pub.chive.claiming.getClaim`               | Query     | Get a specific claim by ID                         |
| `pub.chive.claiming.getUserClaims`          | Query     | List claims for the authenticated user             |
| `pub.chive.claiming.getPendingClaims`       | Query     | List pending claims awaiting approval              |
| `pub.chive.claiming.findClaimable`          | Query     | Find eprints that can be claimed                   |
| `pub.chive.claiming.getSubmissionData`      | Query     | Get data for pre-filling a claim form              |
| `pub.chive.claiming.getSuggestions`         | Query     | Get claim suggestions for the user                 |
| `pub.chive.claiming.autocomplete`           | Query     | Autocomplete for claim search                      |
| `pub.chive.claiming.searchEprints`          | Query     | Search external sources for claimable eprints      |
| `pub.chive.claiming.getCoauthorRequests`    | Query     | List coauthorship requests for an eprint           |
| `pub.chive.claiming.getMyCoauthorRequests`  | Query     | List the user's coauthorship requests              |
| `pub.chive.claiming.startClaim`             | Procedure | Start a new eprint claim                           |
| `pub.chive.claiming.startClaimFromExternal` | Procedure | Start a claim from an external source (arXiv, DOI) |
| `pub.chive.claiming.completeClaim`          | Procedure | Complete a pending claim                           |
| `pub.chive.claiming.approveClaim`           | Procedure | Approve a pending claim                            |
| `pub.chive.claiming.rejectClaim`            | Procedure | Reject a pending claim                             |
| `pub.chive.claiming.requestCoauthorship`    | Procedure | Request coauthorship on an eprint                  |
| `pub.chive.claiming.approveCoauthor`        | Procedure | Approve a coauthorship request                     |
| `pub.chive.claiming.rejectCoauthor`         | Procedure | Reject a coauthorship request                      |
| `pub.chive.claiming.fetchExternalPdf`       | Procedure | Fetch a PDF from an external source                |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Discovery lexicons

Discovery endpoints provide personalized recommendations, citation networks, and content enrichment.

### Discovery queries and procedures

| Lexicon                                  | Type      | Description                                   |
| ---------------------------------------- | --------- | --------------------------------------------- |
| `pub.chive.discovery.getRecommendations` | Query     | Get personalized eprint recommendations       |
| `pub.chive.discovery.getForYou`          | Query     | Get the "For You" feed                        |
| `pub.chive.discovery.getSimilar`         | Query     | Get similar eprints                           |
| `pub.chive.discovery.getCitations`       | Query     | Get citation network for an eprint            |
| `pub.chive.discovery.getEnrichment`      | Query     | Get enrichment data for an eprint             |
| `pub.chive.discovery.recordInteraction`  | Procedure | Record a user interaction for recommendations |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Import lexicons

Import queries search external academic databases for eprints that can be claimed or imported.

### Import queries

| Lexicon                   | Type  | Description                                    |
| ------------------------- | ----- | ---------------------------------------------- |
| `pub.chive.import.search` | Query | Search external sources (arXiv, DOI, etc.)     |
| `pub.chive.import.exists` | Query | Check if an external eprint is already indexed |
| `pub.chive.import.get`    | Query | Get metadata for an external eprint            |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Metrics lexicons

Metrics endpoints track and report usage statistics for eprints.

### Metrics queries and procedures

| Lexicon                                  | Type      | Description                           |
| ---------------------------------------- | --------- | ------------------------------------- |
| `pub.chive.metrics.getMetrics`           | Query     | Get aggregate metrics for an eprint   |
| `pub.chive.metrics.getViewCount`         | Query     | Get view count for an eprint          |
| `pub.chive.metrics.getTrending`          | Query     | Get trending eprints by metrics       |
| `pub.chive.metrics.recordView`           | Procedure | Record an eprint view                 |
| `pub.chive.metrics.recordDownload`       | Procedure | Record an eprint download             |
| `pub.chive.metrics.recordDwellTime`      | Procedure | Record time spent reading an eprint   |
| `pub.chive.metrics.recordSearchClick`    | Procedure | Record a click-through from search    |
| `pub.chive.metrics.recordSearchDownload` | Procedure | Record a download from search results |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Governance lexicons

Governance endpoints manage the community moderation system: proposals, votes, trusted editor roles, and delegation.

### Governance queries and procedures

| Lexicon                                      | Type      | Description                       |
| -------------------------------------------- | --------- | --------------------------------- |
| `pub.chive.governance.listProposals`         | Query     | List governance proposals         |
| `pub.chive.governance.getProposal`           | Query     | Get a single proposal             |
| `pub.chive.governance.listVotes`             | Query     | List votes on a proposal          |
| `pub.chive.governance.getUserVote`           | Query     | Get the user's vote on a proposal |
| `pub.chive.governance.getPendingCount`       | Query     | Get count of pending proposals    |
| `pub.chive.governance.getEditorStatus`       | Query     | Get the user's editor role status |
| `pub.chive.governance.listTrustedEditors`    | Query     | List trusted editors              |
| `pub.chive.governance.listDelegations`       | Query     | List role delegations             |
| `pub.chive.governance.listElevationRequests` | Query     | List pending elevation requests   |
| `pub.chive.governance.requestElevation`      | Procedure | Request elevation to editor role  |
| `pub.chive.governance.approveElevation`      | Procedure | Approve an elevation request      |
| `pub.chive.governance.rejectElevation`       | Procedure | Reject an elevation request       |
| `pub.chive.governance.grantDelegation`       | Procedure | Grant a role delegation           |
| `pub.chive.governance.revokeDelegation`      | Procedure | Revoke a role delegation          |
| `pub.chive.governance.revokeRole`            | Procedure | Revoke an editor role             |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Alpha lexicons

Alpha endpoints manage enrollment in the Chive alpha program.

### Alpha queries and procedures

| Lexicon                       | Type      | Description                           |
| ----------------------------- | --------- | ------------------------------------- |
| `pub.chive.alpha.checkStatus` | Query     | Check the user's alpha program status |
| `pub.chive.alpha.apply`       | Procedure | Apply for the alpha program           |

See [XRPC endpoints](../api-reference/xrpc-endpoints.md) for parameter and response details.

## Common types

### StrongRef

Reference to another record.

```typescript
interface StrongRef {
  uri: string; // AT-URI
  cid: string; // Content ID
}
```

### BlobRef

Reference to a blob stored in a user's PDS. Chive indexes BlobRefs only; it never stores blob content.

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

| Field                | Max length |
| -------------------- | ---------- |
| Title                | 500        |
| Abstract plain text  | 10000      |
| Comment body items   | 500        |
| Tag                  | 50         |
| Bio                  | 1000       |
| LaTeX content        | 10000      |
| Code block content   | 50000      |
| Version changes      | 2000       |
| Reconciliation notes | 1000       |

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
| Contributions       | 15        |

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

| Lexicon                  | Version |
| ------------------------ | ------- |
| `pub.chive.eprint.*`     | 1.0.0   |
| `pub.chive.annotation.*` | 1.0.0   |
| `pub.chive.review.*`     | 1.0.0   |
| `pub.chive.graph.*`      | 1.0.0   |
| `pub.chive.actor.*`      | 1.0.0   |
| `pub.chive.richtext.*`   | 1.0.0   |
| `pub.chive.discovery.*`  | 1.0.0   |

## Related documentation

- [AT Protocol Concepts](../concepts/at-protocol.md): Protocol fundamentals
- [API Reference](../api-reference/xrpc-endpoints.md): XRPC endpoints with parameters and responses
- [Data Sovereignty](../concepts/data-sovereignty.md): Where data lives
- [W3C Web Annotation Model](https://www.w3.org/TR/annotation-model/): Annotation selector specification
