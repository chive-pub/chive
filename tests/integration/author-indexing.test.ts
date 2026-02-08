/**
 * Integration tests for author indexing.
 *
 * @remarks
 * Tests the complete flow:
 * - Eprint with authors → Elasticsearch index → Query by author
 * - Multiple author types (DID, ORCID, external collaborators)
 * - Author filtering in search results
 *
 * Requires Docker test stack running (Elasticsearch 8+).
 *
 * @packageDocumentation
 */

import { Client } from '@elastic/elasticsearch';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { createElasticsearchClient } from '@/storage/elasticsearch/setup.js';
import type { AtUri, CID, DID, Timestamp } from '@/types/atproto.js';
import type { AnnotationBody } from '@/types/models/annotation.js';
import type { EprintAuthor } from '@/types/models/author.js';
import type { Eprint } from '@/types/models/eprint.js';
import { extractPlainText } from '@/utils/rich-text.js';

/** Creates a mock rich text abstract from plain text. */
function createMockAbstract(text: string): AnnotationBody {
  return {
    type: 'RichText',
    items: [{ type: 'text', content: text }],
    format: 'application/x-chive-gloss+json',
  };
}

// Test constants
const TEST_INDEX_NAME = 'test-author-indexing';

// Test authors with different configurations
const AUTHOR_WITH_DID: EprintAuthor = {
  did: 'did:plc:author1' as DID,
  name: 'Dr. Alice Smith',
  orcid: '0000-0001-2345-6789',
  order: 1,
  affiliations: [
    {
      name: 'Stanford University',
      rorId: 'https://ror.org/00f54p054',
      department: 'Computer Science',
    },
  ],
  contributions: [
    {
      typeUri:
        'at://did:plc:chive-governance/pub.chive.graph.node/e1612645-6a62-59b7-a13a-8d618637be85' as AtUri,
      typeId: 'conceptualization',
      typeLabel: 'Conceptualization',
      degree: 'lead',
    },
    {
      typeUri:
        'at://did:plc:chive-governance/pub.chive.graph.node/829cce56-857a-5abb-be9d-9e6b29f51198' as AtUri,
      typeId: 'writing-original-draft',
      typeLabel: 'Writing - Original Draft',
      degree: 'lead',
    },
  ],
  isCorrespondingAuthor: true,
  isHighlighted: false,
};

const AUTHOR_WITH_ORCID_ONLY: EprintAuthor = {
  name: 'Bob Johnson',
  orcid: '0000-0002-3456-7890',
  email: 'bob@external.edu',
  order: 2,
  affiliations: [
    {
      name: 'External Research Institute',
    },
  ],
  contributions: [
    {
      typeUri:
        'at://did:plc:chive-governance/pub.chive.graph.node/5d67f57c-9d4c-59e3-b3b1-d7205b33f6c8' as AtUri,
      typeId: 'investigation',
      typeLabel: 'Investigation',
      degree: 'equal',
    },
  ],
  isCorrespondingAuthor: false,
  isHighlighted: true, // Co-first author
};

const EXTERNAL_COLLABORATOR: EprintAuthor = {
  name: 'Dr. Carol Davis',
  email: 'carol@partner.org',
  order: 3,
  affiliations: [
    {
      name: 'Partner Organization',
      department: 'Research Division',
    },
  ],
  contributions: [
    {
      typeUri:
        'at://did:plc:chive-governance/pub.chive.graph.node/fa5c6fc7-2202-5e45-8364-7740ae534f7c' as AtUri,
      typeId: 'data-curation',
      typeLabel: 'Data Curation',
      degree: 'supporting',
    },
  ],
  isCorrespondingAuthor: false,
  isHighlighted: false,
};

const AUTHOR_WITH_DID_2: EprintAuthor = {
  did: 'did:plc:author2' as DID,
  name: 'Dr. Diana Evans',
  orcid: '0000-0003-4567-8901',
  order: 1,
  affiliations: [
    {
      name: 'MIT',
      rorId: 'https://ror.org/042nb2s44',
    },
  ],
  contributions: [
    {
      typeUri:
        'at://did:plc:chive-governance/pub.chive.graph.node/052bfbce-9b15-55fd-8efc-99e82f7abeb2' as AtUri,
      typeId: 'methodology',
      typeLabel: 'Methodology',
      degree: 'lead',
    },
  ],
  isCorrespondingAuthor: true,
  isHighlighted: false,
};

/**
 * Map author to Elasticsearch document format.
 */
function mapAuthorToDocument(author: EprintAuthor): object {
  return {
    did: author.did,
    name: author.name,
    orcid: author.orcid,
    email: author.email,
    order: author.order,
    affiliations: author.affiliations.map((a) => ({
      name: a.name,
      rorId: a.rorId,
      department: a.department,
    })),
    contributions: author.contributions.map((c) => ({
      typeId: c.typeId,
      typeLabel: c.typeLabel,
      degree: c.degree,
    })),
    isCorrespondingAuthor: author.isCorrespondingAuthor,
    isHighlighted: author.isHighlighted,
  };
}

/**
 * Map eprint to Elasticsearch document format.
 */
function mapEprintToDocument(eprint: Eprint, pdsUrl: string): object {
  return {
    uri: eprint.uri,
    cid: eprint.cid,
    title: eprint.title,
    abstract: eprint.abstractPlainText ?? extractPlainText(eprint.abstract),
    submittedBy: eprint.submittedBy,
    paperDid: eprint.paperDid,
    authors: eprint.authors.map(mapAuthorToDocument),
    // Flatten author fields for filtering
    author_dids: eprint.authors.filter((a) => a.did).map((a) => a.did),
    author_names: eprint.authors.map((a) => a.name),
    author_orcids: eprint.authors.filter((a) => a.orcid).map((a) => a.orcid),
    author_emails: eprint.authors.filter((a) => a.email).map((a) => a.email),
    corresponding_authors: eprint.authors
      .filter((a) => a.isCorrespondingAuthor)
      .map((a) => a.did ?? a.name),
    highlighted_authors: eprint.authors.filter((a) => a.isHighlighted).map((a) => a.name),
    pds_url: pdsUrl,
    created_at: new Date(eprint.createdAt).toISOString(),
    indexed_at: new Date().toISOString(),
  };
}

describe('Author Indexing Integration', () => {
  let client: Client;

  beforeAll(async () => {
    client = createElasticsearchClient();

    // Create test index with author-optimized mappings
    if (await client.indices.exists({ index: TEST_INDEX_NAME })) {
      await client.indices.delete({ index: TEST_INDEX_NAME });
    }

    await client.indices.create({
      index: TEST_INDEX_NAME,
      mappings: {
        properties: {
          uri: { type: 'keyword' },
          cid: { type: 'keyword' },
          title: { type: 'text', analyzer: 'standard' },
          abstract: { type: 'text', analyzer: 'standard' },
          submittedBy: { type: 'keyword' },
          paperDid: { type: 'keyword' },
          authors: {
            type: 'nested',
            properties: {
              did: { type: 'keyword' },
              name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              orcid: { type: 'keyword' },
              email: { type: 'keyword' },
              order: { type: 'integer' },
              affiliations: {
                type: 'nested',
                properties: {
                  name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                  rorId: { type: 'keyword' },
                  department: { type: 'text' },
                },
              },
              contributions: {
                type: 'nested',
                properties: {
                  typeId: { type: 'keyword' },
                  typeLabel: { type: 'text' },
                  degree: { type: 'keyword' },
                },
              },
              isCorrespondingAuthor: { type: 'boolean' },
              isHighlighted: { type: 'boolean' },
            },
          },
          // Flattened fields for simple filtering
          author_dids: { type: 'keyword' },
          author_names: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          author_orcids: { type: 'keyword' },
          author_emails: { type: 'keyword' },
          corresponding_authors: { type: 'keyword' },
          highlighted_authors: { type: 'text' },
          pds_url: { type: 'keyword' },
          created_at: { type: 'date' },
          indexed_at: { type: 'date' },
        },
      },
    });
  });

  afterAll(async () => {
    if (await client.indices.exists({ index: TEST_INDEX_NAME })) {
      await client.indices.delete({ index: TEST_INDEX_NAME });
    }
    await client.close();
  });

  beforeEach(async () => {
    // Clean up existing documents
    try {
      await client.deleteByQuery({
        index: TEST_INDEX_NAME,
        query: { match_all: {} },
        refresh: true,
      });
    } catch {
      // Index may be empty
    }
  });

  describe('Author with DID indexing', () => {
    it('indexes eprint with DID author correctly', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:author1/pub.chive.eprint.submission/test1' as AtUri,
        cid: 'bafytest1' as CID,
        title: 'Test Paper with DID Author',
        abstract: createMockAbstract('This paper has an author with a DID.'),
        submittedBy: 'did:plc:author1' as DID,
        authors: [AUTHOR_WITH_DID],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      const doc = mapEprintToDocument(eprint, 'https://bsky.social');
      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
        document: doc,
        refresh: true,
      });

      // Verify indexed
      const result = await client.get({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
      });

      expect(result._source).toBeDefined();
      const source = result._source as Record<string, unknown>;
      expect(source.author_dids).toContain('did:plc:author1');
      expect(source.author_orcids).toContain('0000-0001-2345-6789');
    });

    it('can filter by author DID', async () => {
      const eprint1: Eprint = {
        uri: 'at://did:plc:author1/pub.chive.eprint.submission/p1' as AtUri,
        cid: 'bafyp1' as CID,
        title: 'Paper by Author 1',
        abstract: createMockAbstract('Abstract for paper 1.'),
        submittedBy: 'did:plc:author1' as DID,
        authors: [AUTHOR_WITH_DID],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob1' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      const eprint2: Eprint = {
        uri: 'at://did:plc:author2/pub.chive.eprint.submission/p2' as AtUri,
        cid: 'bafyp2' as CID,
        title: 'Paper by Author 2',
        abstract: createMockAbstract('Abstract for paper 2.'),
        submittedBy: 'did:plc:author2' as DID,
        authors: [AUTHOR_WITH_DID_2],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob2' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      // Index both
      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint1.uri,
        document: mapEprintToDocument(eprint1, 'https://bsky.social'),
      });
      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint2.uri,
        document: mapEprintToDocument(eprint2, 'https://bsky.social'),
        refresh: true,
      });

      // Filter by author 1
      const result = await client.search({
        index: TEST_INDEX_NAME,
        query: {
          term: { author_dids: 'did:plc:author1' },
        },
      });

      expect(result.hits.hits).toHaveLength(1);
      expect((result.hits.hits[0]?._source as Record<string, unknown>).uri).toBe(eprint1.uri);
    });
  });

  describe('Author with ORCID indexing', () => {
    it('indexes eprint with ORCID-only author', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:submitter/pub.chive.eprint.submission/orcid1' as AtUri,
        cid: 'bafyorcid1' as CID,
        title: 'Paper with ORCID Author',
        abstract: createMockAbstract('This paper has an external author with ORCID.'),
        submittedBy: 'did:plc:submitter' as DID,
        authors: [AUTHOR_WITH_DID, AUTHOR_WITH_ORCID_ONLY],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
        document: mapEprintToDocument(eprint, 'https://bsky.social'),
        refresh: true,
      });

      // Filter by ORCID
      const result = await client.search({
        index: TEST_INDEX_NAME,
        query: {
          term: { author_orcids: '0000-0002-3456-7890' },
        },
      });

      expect(result.hits.hits).toHaveLength(1);
      const source = result.hits.hits[0]?._source as Record<string, unknown>;
      expect((source.authors as { orcid: string }[])[1]?.orcid).toBe('0000-0002-3456-7890');
    });

    it('can filter by ORCID', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:sub/pub.chive.eprint.submission/orcid2' as AtUri,
        cid: 'bafyorcid2' as CID,
        title: 'Another ORCID Paper',
        abstract: createMockAbstract('Testing ORCID filtering.'),
        submittedBy: 'did:plc:sub' as DID,
        authors: [AUTHOR_WITH_DID_2],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
        document: mapEprintToDocument(eprint, 'https://bsky.social'),
        refresh: true,
      });

      // Filter by Diana's ORCID
      const result = await client.search({
        index: TEST_INDEX_NAME,
        query: {
          term: { author_orcids: '0000-0003-4567-8901' },
        },
      });

      expect(result.hits.hits).toHaveLength(1);
    });
  });

  describe('External collaborator indexing', () => {
    it('indexes eprint with external collaborator (no DID)', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:sub/pub.chive.eprint.submission/ext1' as AtUri,
        cid: 'bafyext1' as CID,
        title: 'Paper with External Collaborator',
        abstract: createMockAbstract('This paper includes an external collaborator without DID.'),
        submittedBy: 'did:plc:sub' as DID,
        authors: [AUTHOR_WITH_DID, EXTERNAL_COLLABORATOR],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
        document: mapEprintToDocument(eprint, 'https://bsky.social'),
        refresh: true,
      });

      // Search by external author name
      const result = await client.search({
        index: TEST_INDEX_NAME,
        query: {
          match: { author_names: 'Carol Davis' },
        },
      });

      expect(result.hits.hits).toHaveLength(1);
    });

    it('can filter by email for external collaborators', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:sub/pub.chive.eprint.submission/ext2' as AtUri,
        cid: 'bafyext2' as CID,
        title: 'Another External Paper',
        abstract: createMockAbstract('Testing email filtering.'),
        submittedBy: 'did:plc:sub' as DID,
        authors: [EXTERNAL_COLLABORATOR],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
        document: mapEprintToDocument(eprint, 'https://bsky.social'),
        refresh: true,
      });

      // Filter by email
      const result = await client.search({
        index: TEST_INDEX_NAME,
        query: {
          term: { author_emails: 'carol@partner.org' },
        },
      });

      expect(result.hits.hits).toHaveLength(1);
    });
  });

  describe('Highlighted and corresponding author indexing', () => {
    it('indexes highlighted (co-first) authors correctly', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:sub/pub.chive.eprint.submission/hl1' as AtUri,
        cid: 'bafyhl1' as CID,
        title: 'Paper with Co-First Authors',
        abstract: createMockAbstract('This paper has co-first authors.'),
        submittedBy: 'did:plc:sub' as DID,
        authors: [
          { ...AUTHOR_WITH_DID, isHighlighted: true },
          AUTHOR_WITH_ORCID_ONLY, // Already highlighted
        ],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
        document: mapEprintToDocument(eprint, 'https://bsky.social'),
        refresh: true,
      });

      const result = await client.get({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
      });

      const source = result._source as Record<string, unknown>;
      const highlightedAuthors = source.highlighted_authors as string[];
      expect(highlightedAuthors).toContain('Dr. Alice Smith');
      expect(highlightedAuthors).toContain('Bob Johnson');
    });

    it('indexes corresponding authors correctly', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:sub/pub.chive.eprint.submission/ca1' as AtUri,
        cid: 'bafyca1' as CID,
        title: 'Paper with Corresponding Author',
        abstract: createMockAbstract('Testing corresponding author indexing.'),
        submittedBy: 'did:plc:sub' as DID,
        authors: [AUTHOR_WITH_DID, AUTHOR_WITH_ORCID_ONLY],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
        document: mapEprintToDocument(eprint, 'https://bsky.social'),
        refresh: true,
      });

      const result = await client.get({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
      });

      const source = result._source as Record<string, unknown>;
      const correspondingAuthors = source.corresponding_authors as string[];
      expect(correspondingAuthors).toContain('did:plc:author1');
      expect(correspondingAuthors).not.toContain('Bob Johnson');
    });
  });

  describe('Author affiliation indexing', () => {
    it('indexes author affiliations with ROR IDs', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:sub/pub.chive.eprint.submission/aff1' as AtUri,
        cid: 'bafyaff1' as CID,
        title: 'Paper with ROR Affiliations',
        abstract: createMockAbstract('Testing affiliation indexing.'),
        submittedBy: 'did:plc:sub' as DID,
        authors: [AUTHOR_WITH_DID],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
        document: mapEprintToDocument(eprint, 'https://bsky.social'),
        refresh: true,
      });

      // Query by nested affiliation
      const result = await client.search({
        index: TEST_INDEX_NAME,
        query: {
          nested: {
            path: 'authors.affiliations',
            query: {
              term: { 'authors.affiliations.rorId': 'https://ror.org/00f54p054' },
            },
          },
        },
      });

      expect(result.hits.hits).toHaveLength(1);
    });
  });

  describe('Author contribution indexing', () => {
    it('indexes author contributions with types and degrees', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:sub/pub.chive.eprint.submission/contrib1' as AtUri,
        cid: 'bafycontrib1' as CID,
        title: 'Paper with Contribution Types',
        abstract: createMockAbstract('Testing contribution indexing.'),
        submittedBy: 'did:plc:sub' as DID,
        authors: [AUTHOR_WITH_DID],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
        document: mapEprintToDocument(eprint, 'https://bsky.social'),
        refresh: true,
      });

      // Query by nested contribution type
      const result = await client.search({
        index: TEST_INDEX_NAME,
        query: {
          nested: {
            path: 'authors.contributions',
            query: {
              term: { 'authors.contributions.typeId': 'conceptualization' },
            },
          },
        },
      });

      expect(result.hits.hits).toHaveLength(1);
    });

    it('can filter by contribution degree', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:sub/pub.chive.eprint.submission/deg1' as AtUri,
        cid: 'bafydeg1' as CID,
        title: 'Paper with Lead Contributions',
        abstract: createMockAbstract('Testing degree filtering.'),
        submittedBy: 'did:plc:sub' as DID,
        authors: [AUTHOR_WITH_DID],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
        document: mapEprintToDocument(eprint, 'https://bsky.social'),
        refresh: true,
      });

      // Query by lead degree
      const result = await client.search({
        index: TEST_INDEX_NAME,
        query: {
          nested: {
            path: 'authors.contributions',
            query: {
              term: { 'authors.contributions.degree': 'lead' },
            },
          },
        },
      });

      expect(result.hits.hits).toHaveLength(1);
    });
  });

  describe('Paper-centric vs traditional submission indexing', () => {
    it('indexes traditional submission (no paperDid)', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:user123/pub.chive.eprint.submission/trad1' as AtUri,
        cid: 'bafytrad1' as CID,
        title: 'Traditional Submission',
        abstract: createMockAbstract('Paper lives in submitter PDS.'),
        submittedBy: 'did:plc:user123' as DID,
        paperDid: undefined,
        authors: [AUTHOR_WITH_DID],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
        document: mapEprintToDocument(eprint, 'https://bsky.social'),
        refresh: true,
      });

      const result = await client.get({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
      });

      const source = result._source as Record<string, unknown>;
      expect(source.paperDid).toBeUndefined();
      expect(source.submittedBy).toBe('did:plc:user123');
    });

    it('indexes paper-centric submission (with paperDid)', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:paper-abc/pub.chive.eprint.submission/pc1' as AtUri,
        cid: 'bafypc1' as CID,
        title: 'Paper-Centric Submission',
        abstract: createMockAbstract('Paper has its own PDS.'),
        submittedBy: 'did:plc:user123' as DID,
        paperDid: 'did:plc:paper-abc' as DID,
        authors: [AUTHOR_WITH_DID],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
        document: mapEprintToDocument(eprint, 'https://paper-pds.example.com'),
        refresh: true,
      });

      const result = await client.get({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
      });

      const source = result._source as Record<string, unknown>;
      expect(source.paperDid).toBe('did:plc:paper-abc');
      expect(source.submittedBy).toBe('did:plc:user123');
    });

    it('can filter by paperDid', async () => {
      const eprint: Eprint = {
        uri: 'at://did:plc:paper-xyz/pub.chive.eprint.submission/pc2' as AtUri,
        cid: 'bafypc2' as CID,
        title: 'Another Paper-Centric',
        abstract: createMockAbstract('Testing paperDid filtering.'),
        submittedBy: 'did:plc:user456' as DID,
        paperDid: 'did:plc:paper-xyz' as DID,
        authors: [AUTHOR_WITH_DID_2],
        version: 1,
        license: 'CC-BY-4.0',
        keywords: [],
        facets: [],
        documentBlobRef: {
          $type: 'blob',
          ref: 'bafyreiblob' as CID,
          mimeType: 'application/pdf',
          size: 1024000,
        },
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        createdAt: Date.now() as Timestamp,
      };

      await client.index({
        index: TEST_INDEX_NAME,
        id: eprint.uri,
        document: mapEprintToDocument(eprint, 'https://paper-pds.example.com'),
        refresh: true,
      });

      const result = await client.search({
        index: TEST_INDEX_NAME,
        query: {
          term: { paperDid: 'did:plc:paper-xyz' },
        },
      });

      expect(result.hits.hits).toHaveLength(1);
    });
  });
});
