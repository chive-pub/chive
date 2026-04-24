/**
 * Shared helpers for building rich server-rendered metadata on Chive
 * entity pages.
 *
 * @remarks
 * Centralizes the construction of OpenGraph, Twitter card, Zotero/Highwire
 * `citation_*` meta tags, Schema.org JSON-LD, and `<link rel="alternate">`
 * convention tags so every entity page (eprints, graph nodes, authors,
 * collections, and the canonical external-ID routes) emits consistent,
 * Citoid-scrapable HTML. This is how Chive pages become first-class
 * citizens in the Semble/Margin/Citoid ecosystems, where HTML scraping
 * (rather than ATProto lookup) is how cross-app card previews are
 * constructed today.
 *
 * See also:
 *
 * - W3C Zotero / Highwire-press citation_* convention:
 *   https://www.zotero.org/support/dev/exposing_metadata
 * - Wikipedia Citoid: https://en.wikipedia.org/api/rest_v1/#/Citation
 * - Semble `<link rel="alternate">` AT-URI aggregation plan.
 *
 * @packageDocumentation
 */

import type { Metadata } from 'next';

/**
 * One W3C-style external identifier for an entity.
 *
 * @public
 */
export interface EntityExternalId {
  system: string;
  identifier: string;
  uri?: string;
}

/**
 * Minimal input for building entity metadata.
 *
 * @remarks
 * Fields are optional because different entity kinds expose different
 * subsets. Missing fields are simply omitted from the resulting tags.
 *
 * @public
 */
export interface EntityMetadataInput {
  /** AT-URI of the entity (e.g., `at://did:.../pub.chive.graph.node/abc`). */
  atUri: string;
  /** Chive canonical web URL of the entity. */
  canonicalUrl: string;
  /** Display title. */
  title: string;
  /** Short description for OG/Twitter (≤300 chars recommended). */
  description?: string;
  /** OG image URL (absolute or relative path). */
  ogImageUrl?: string;
  /**
   * Entity type for Schema.org / OG type discrimination.
   * - `research`: `ScholarlyArticle`, OG `article`
   * - `author`: `Person`, OG `profile`
   * - `collection`: `Collection`, OG `website`
   * - `concept` / `field` / `institution` / `event`: `Thing`, OG `website`
   */
  entityType: 'research' | 'author' | 'collection' | 'concept' | 'field' | 'institution' | 'event';
  /** Authors for scholarly artifacts (name only is fine). */
  authors?: string[];
  /** Publication date (ISO 8601). */
  publishedDate?: string;
  /** Journal / venue title for scholarly artifacts. */
  journalTitle?: string;
  /** URL to the full-text PDF when available. */
  pdfUrl?: string;
  /** External identifiers (DOI, arXiv, ORCID, ROR, ISBN, PMID, etc.). */
  externalIds?: EntityExternalId[];
  /** Handle for author pages (e.g., `alice.bsky.social`). */
  authorHandle?: string;
}

/**
 * Builds the Next.js `Metadata` object for an entity page.
 *
 * @remarks
 * Covers OpenGraph, Twitter card, canonical URL, and keywords. Does NOT
 * cover `<link rel="alternate">` or `citation_*` tags — those are emitted
 * as raw HTML via {@link renderEntityHeadTags}.
 *
 * @param input - Entity metadata input
 * @returns Next.js `Metadata` object
 *
 * @public
 */
export function buildEntityMetadata(input: EntityMetadataInput): Metadata {
  const ogType: 'article' | 'profile' | 'website' =
    input.entityType === 'research'
      ? 'article'
      : input.entityType === 'author'
        ? 'profile'
        : 'website';

  const metadata: Metadata = {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: input.canonicalUrl,
    },
    openGraph: {
      title: input.title,
      description: input.description,
      type: ogType,
      url: input.canonicalUrl,
      siteName: 'Chive',
      images: input.ogImageUrl
        ? [
            {
              url: input.ogImageUrl,
              width: 1200,
              height: 630,
              alt: input.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: input.ogImageUrl ? [input.ogImageUrl] : undefined,
    },
  };

  if (input.authors && input.authors.length > 0 && metadata.openGraph) {
    (metadata.openGraph as { authors?: string[] }).authors = input.authors;
  }
  if (input.publishedDate && metadata.openGraph) {
    (metadata.openGraph as { publishedTime?: string }).publishedTime = input.publishedDate;
  }

  return metadata;
}

/**
 * Builds the collection of raw `<meta>` / `<link>` / `<script>` tag
 * descriptors that `generateMetadata` cannot express but that the entity
 * page should render into `<head>`.
 *
 * @remarks
 * Call sites render these via a small component:
 *
 * ```tsx
 * {renderEntityHeadTags(descriptors).map((t, i) => <EntityHeadTag key={i} {...t} />)}
 * ```
 *
 * Emitted tags:
 *
 * - `<link rel="alternate" type="application/at-uri" href="...">` —
 *   Wes/Semble convention for AT-URI aggregation.
 * - `<link rel="alternate" href="https://doi.org/...">` — canonical DOI
 *   resolver link so Semble / Citoid / Zotero can aggregate by DOI.
 * - `<link rel="alternate" href="https://orcid.org/...">` etc.
 * - `<meta name="citation_title">` family (Highwire / Zotero convention).
 * - `<script type="application/ld+json">` — Schema.org JSON-LD.
 *
 * @param input - Entity metadata input
 * @returns Array of tag descriptors
 *
 * @public
 */
export function buildEntityHeadTags(input: EntityMetadataInput): EntityHeadTag[] {
  const tags: EntityHeadTag[] = [];

  // 1. `<link rel="alternate">` for AT-URI aggregation (Wes/Semble convention)
  tags.push({
    kind: 'link',
    rel: 'alternate',
    type: 'application/at-uri',
    href: input.atUri,
  });

  // 2. `<link rel="alternate">` for each external identifier (DOI, ORCID, etc.)
  for (const ext of input.externalIds ?? []) {
    const href = ext.uri ?? canonicalExternalIdUrl(ext.system, ext.identifier);
    if (!href) continue;
    tags.push({
      kind: 'link',
      rel: 'alternate',
      href,
      title: `${ext.system.toUpperCase()}: ${ext.identifier}`,
    });
  }

  // 3. Highwire `citation_*` meta tags (scholarly)
  if (input.entityType === 'research') {
    tags.push({ kind: 'meta', name: 'citation_title', content: input.title });
    for (const author of input.authors ?? []) {
      tags.push({ kind: 'meta', name: 'citation_author', content: author });
    }
    if (input.publishedDate) {
      const date = new Date(input.publishedDate);
      if (!isNaN(date.getTime())) {
        const yyyy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(date.getUTCDate()).padStart(2, '0');
        tags.push({
          kind: 'meta',
          name: 'citation_publication_date',
          content: `${yyyy}/${mm}/${dd}`,
        });
      }
    }
    const doi = input.externalIds?.find((id) => id.system === 'doi')?.identifier;
    if (doi) {
      tags.push({ kind: 'meta', name: 'citation_doi', content: doi });
    }
    const arxiv = input.externalIds?.find((id) => id.system === 'arxiv')?.identifier;
    if (arxiv) {
      tags.push({ kind: 'meta', name: 'citation_arxiv_id', content: arxiv });
    }
    const pmid = input.externalIds?.find((id) => id.system === 'pmid')?.identifier;
    if (pmid) {
      tags.push({ kind: 'meta', name: 'citation_pmid', content: pmid });
    }
    if (input.journalTitle) {
      tags.push({ kind: 'meta', name: 'citation_journal_title', content: input.journalTitle });
    }
    tags.push({
      kind: 'meta',
      name: 'citation_abstract_html_url',
      content: input.canonicalUrl,
    });
    if (input.pdfUrl) {
      tags.push({ kind: 'meta', name: 'citation_pdf_url', content: input.pdfUrl });
    }
  }

  // 4. Schema.org JSON-LD
  tags.push({
    kind: 'script',
    type: 'application/ld+json',
    content: JSON.stringify(buildSchemaOrg(input)),
  });

  return tags;
}

/**
 * Tag descriptor emitted by {@link buildEntityHeadTags}.
 *
 * @public
 */
export type EntityHeadTag =
  | {
      kind: 'link';
      rel: string;
      type?: string;
      href: string;
      title?: string;
    }
  | {
      kind: 'meta';
      name: string;
      content: string;
    }
  | {
      kind: 'script';
      type: 'application/ld+json';
      content: string;
    };

/**
 * Derives a canonical resolver URL for a known external-ID system.
 *
 * @internal
 */
function canonicalExternalIdUrl(system: string, identifier: string): string | undefined {
  switch (system) {
    case 'doi':
      return `https://doi.org/${identifier}`;
    case 'arxiv':
      return `https://arxiv.org/abs/${identifier}`;
    case 'orcid':
      return `https://orcid.org/${identifier}`;
    case 'ror':
      return `https://ror.org/${identifier}`;
    case 'isbn':
      return `https://www.worldcat.org/isbn/${identifier}`;
    case 'pmid':
      return `https://pubmed.ncbi.nlm.nih.gov/${identifier}`;
    case 'wikidata':
      return `https://www.wikidata.org/wiki/${identifier}`;
    default:
      return undefined;
  }
}

/**
 * Builds a Schema.org JSON-LD object for the entity.
 *
 * @internal
 */
function buildSchemaOrg(input: EntityMetadataInput): Record<string, unknown> {
  const ldType =
    input.entityType === 'research'
      ? 'ScholarlyArticle'
      : input.entityType === 'author'
        ? 'Person'
        : input.entityType === 'collection'
          ? 'Collection'
          : 'Thing';

  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ldType,
    name: input.title,
    url: input.canonicalUrl,
  };

  if (input.description) base.description = input.description;
  if (input.ogImageUrl) base.image = input.ogImageUrl;

  if (input.entityType === 'research') {
    if (input.authors && input.authors.length > 0) {
      base.author = input.authors.map((name) => ({ '@type': 'Person', name }));
    }
    if (input.publishedDate) base.datePublished = input.publishedDate;
    const doi = input.externalIds?.find((id) => id.system === 'doi')?.identifier;
    if (doi) {
      base.identifier = [
        {
          '@type': 'PropertyValue',
          propertyID: 'doi',
          value: doi,
          url: `https://doi.org/${doi}`,
        },
      ];
    }
    if (input.journalTitle) {
      base.isPartOf = {
        '@type': 'Periodical',
        name: input.journalTitle,
      };
    }
  } else if (input.entityType === 'author' && input.authorHandle) {
    base.alternateName = `@${input.authorHandle}`;
  }

  return base;
}
