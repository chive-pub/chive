/**
 * Integration tests for firehose author records processing.
 *
 * @remarks
 * Tests the complete flow:
 * - Submission published → Firehose event → AppView indexes authors correctly
 * - Validates author data integrity through indexing pipeline
 * - Tests paper-centric vs traditional submission handling
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';

import type { AtUri, CID, DID } from '@/types/atproto.js';
import type { EprintAuthor } from '@/types/models/author.js';
import type { Eprint } from '@/types/models/eprint.js';

import { TEST_GRAPH_PDS_DID } from '../test-constants.js';

// =============================================================================
// Mock Firehose Event Types
// =============================================================================

interface FirehoseEvent {
  seq: number;
  time: string;
  type: 'commit' | 'identity' | 'account';
  repo: DID;
  commit?: CommitEvent;
}

interface CommitEvent {
  rev: string;
  operation: 'create' | 'update' | 'delete';
  collection: string;
  rkey: string;
  record?: Record<string, unknown>;
  cid?: CID;
}

interface IndexedEprint {
  uri: AtUri;
  cid: CID;
  title: string;
  abstract: string;
  submittedBy: DID;
  paperDid?: DID;
  authors: EprintAuthor[];
  pdsUrl: string;
  indexedAt: Date;
}

// =============================================================================
// Mock Firehose Consumer
// =============================================================================

class MockFirehoseConsumer {
  private handlers = new Map<string, (event: FirehoseEvent) => Promise<void>>();

  on(eventType: string, handler: (event: FirehoseEvent) => Promise<void>): void {
    this.handlers.set(eventType, handler);
  }

  async emit(event: FirehoseEvent): Promise<void> {
    const handler = this.handlers.get(event.type);
    if (handler) {
      await handler(event);
    }
  }
}

// =============================================================================
// Mock Indexer
// =============================================================================

class MockEprintIndexer {
  private indexed = new Map<AtUri, IndexedEprint>();
  private pdsRegistry = new Map<DID, string>();

  constructor() {
    // Initialize some PDSes
    this.pdsRegistry.set('did:plc:user1' as DID, 'https://user1.bsky.social');
    this.pdsRegistry.set('did:plc:user2' as DID, 'https://user2.bsky.social');
    this.pdsRegistry.set('did:plc:paper-abc' as DID, 'https://paper-abc.pds.example.com');
  }

  resolvePds(did: DID): string {
    return this.pdsRegistry.get(did) ?? 'https://bsky.social';
  }

  indexEprint(
    record: Record<string, unknown>,
    metadata: { uri: AtUri; cid: CID; repo: DID }
  ): Promise<IndexedEprint> {
    const authors = (record.authors as EprintAuthor[]) ?? [];
    const submittedBy = (record.submittedBy as DID) ?? metadata.repo;
    const paperDid = record.paperDid as DID | undefined;

    // Determine PDS based on paper-centric or traditional model
    const pdsHost = paperDid ?? submittedBy;
    const pdsUrl = this.resolvePds(pdsHost);

    const indexed: IndexedEprint = {
      uri: metadata.uri,
      cid: metadata.cid,
      title: record.title as string,
      abstract: record.abstract as string,
      submittedBy,
      paperDid,
      authors,
      pdsUrl,
      indexedAt: new Date(),
    };

    this.indexed.set(metadata.uri, indexed);
    return Promise.resolve(indexed);
  }

  getIndexed(uri: AtUri): IndexedEprint | undefined {
    return this.indexed.get(uri);
  }

  getAllIndexed(): IndexedEprint[] {
    return Array.from(this.indexed.values());
  }

  updateEprint(
    uri: AtUri,
    record: Record<string, unknown>,
    cid: CID
  ): Promise<IndexedEprint | null> {
    const existing = this.indexed.get(uri);
    if (!existing) return Promise.resolve(null);

    const updated: IndexedEprint = {
      ...existing,
      cid,
      title: (record.title as string) ?? existing.title,
      abstract: (record.abstract as string) ?? existing.abstract,
      authors: (record.authors as EprintAuthor[]) ?? existing.authors,
      indexedAt: new Date(),
    };

    this.indexed.set(uri, updated);
    return Promise.resolve(updated);
  }

  deleteEprint(uri: AtUri): Promise<void> {
    this.indexed.delete(uri);
    return Promise.resolve();
  }
}

// =============================================================================
// Test Fixtures
// =============================================================================

function createFirehoseEvent(
  repo: DID,
  operation: CommitEvent['operation'],
  collection: string,
  rkey: string,
  record?: Record<string, unknown>,
  cid?: CID
): FirehoseEvent {
  return {
    seq: Date.now(),
    time: new Date().toISOString(),
    type: 'commit',
    repo,
    commit: {
      rev: `rev-${Date.now()}`,
      operation,
      collection,
      rkey,
      record,
      cid: cid ?? (`bafycid${Date.now()}` as CID),
    },
  };
}

function createEprintRecord(overrides: Partial<Eprint> = {}): Record<string, unknown> {
  const defaultAuthor: EprintAuthor = {
    did: 'did:plc:author1' as DID,
    name: 'Test Author',
    order: 1,
    affiliations: [{ name: 'Test University' }],
    contributions: [
      {
        typeUri:
          `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/e1612645-6a62-59b7-a13a-8d618637be85` as AtUri,
        typeId: 'conceptualization',
        typeLabel: 'Conceptualization',
        degree: 'lead',
      },
    ],
    isCorrespondingAuthor: true,
    isHighlighted: false,
  };

  return {
    $type: 'pub.chive.eprint.submission',
    title: 'Test Eprint',
    abstract: 'This is a test abstract.',
    submittedBy: 'did:plc:user1',
    authors: [defaultAuthor],
    documentBlobRef: {
      $type: 'blob',
      ref: 'bafyblob123',
      mimeType: 'application/pdf',
      size: 1024000,
    },
    documentFormat: 'pdf',
    publicationStatus: 'eprint',
    version: 1,
    license: 'CC-BY-4.0',
    createdAt: Date.now(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Firehose Author Records Integration', () => {
  let firehose: MockFirehoseConsumer;
  let indexer: MockEprintIndexer;

  beforeEach(() => {
    firehose = new MockFirehoseConsumer();
    indexer = new MockEprintIndexer();

    // Set up firehose handler
    firehose.on('commit', async (event) => {
      if (
        event.commit?.collection === 'pub.chive.eprint.submission' &&
        event.commit.operation === 'create' &&
        event.commit.cid
      ) {
        const uri = `at://${event.repo}/${event.commit.collection}/${event.commit.rkey}` as AtUri;
        await indexer.indexEprint(event.commit.record ?? {}, {
          uri,
          cid: event.commit.cid,
          repo: event.repo,
        });
      }

      if (
        event.commit?.collection === 'pub.chive.eprint.submission' &&
        event.commit.operation === 'update' &&
        event.commit.cid
      ) {
        const uri = `at://${event.repo}/${event.commit.collection}/${event.commit.rkey}` as AtUri;
        await indexer.updateEprint(uri, event.commit.record ?? {}, event.commit.cid);
      }

      if (
        event.commit?.collection === 'pub.chive.eprint.submission' &&
        event.commit.operation === 'delete'
      ) {
        const uri = `at://${event.repo}/${event.commit.collection}/${event.commit.rkey}` as AtUri;
        await indexer.deleteEprint(uri);
      }
    });
  });

  describe('Create Operation', () => {
    it('indexes new eprint with authors from firehose', async () => {
      const author: EprintAuthor = {
        did: 'did:plc:alice' as DID,
        name: 'Dr. Alice Smith',
        orcid: '0000-0001-2345-6789',
        order: 1,
        affiliations: [{ name: 'Stanford University', rorId: 'https://ror.org/00f54p054' }],
        contributions: [
          {
            typeUri:
              `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/e1612645-6a62-59b7-a13a-8d618637be85` as AtUri,
            typeId: 'conceptualization',
            typeLabel: 'Conceptualization',
            degree: 'lead',
          },
        ],
        isCorrespondingAuthor: true,
        isHighlighted: false,
      };

      const record = createEprintRecord({
        title: 'Firehose Indexed Paper',
        submittedBy: 'did:plc:user1' as DID,
        authors: [author],
      });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'test123',
          record
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:user1/pub.chive.eprint.submission/test123' as AtUri
      );

      expect(indexed).toBeDefined();
      expect(indexed?.authors).toHaveLength(1);
      expect(indexed?.authors[0]?.did).toBe('did:plc:alice');
      expect(indexed?.authors[0]?.orcid).toBe('0000-0001-2345-6789');
    });

    it('indexes multiple authors with correct order', async () => {
      const authors: EprintAuthor[] = [
        {
          did: 'did:plc:first' as DID,
          name: 'First Author',
          order: 1,
          affiliations: [],
          contributions: [],
          isCorrespondingAuthor: true,
          isHighlighted: true,
        },
        {
          name: 'Second Author (External)',
          orcid: '0000-0002-1111-2222',
          email: 'second@external.edu',
          order: 2,
          affiliations: [{ name: 'External Institution' }],
          contributions: [],
          isCorrespondingAuthor: false,
          isHighlighted: true, // Co-first
        },
        {
          did: 'did:plc:third' as DID,
          name: 'Third Author',
          order: 3,
          affiliations: [],
          contributions: [],
          isCorrespondingAuthor: false,
          isHighlighted: false,
        },
      ];

      const record = createEprintRecord({ authors });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'multi-author',
          record
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:user1/pub.chive.eprint.submission/multi-author' as AtUri
      );

      expect(indexed?.authors).toHaveLength(3);
      expect(indexed?.authors[0]?.order).toBe(1);
      expect(indexed?.authors[1]?.order).toBe(2);
      expect(indexed?.authors[2]?.order).toBe(3);
    });

    it('indexes external collaborators without DID', async () => {
      const externalAuthor: EprintAuthor = {
        name: 'External Collaborator',
        email: 'external@partner.org',
        orcid: '0000-0003-9999-8888',
        order: 2,
        affiliations: [{ name: 'Partner Organization' }],
        contributions: [
          {
            typeUri:
              `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/fa5c6fc7-2202-5e45-8364-7740ae534f7c` as AtUri,
            typeId: 'data-curation',
            typeLabel: 'Data Curation',
            degree: 'supporting',
          },
        ],
        isCorrespondingAuthor: false,
        isHighlighted: false,
      };

      const record = createEprintRecord({
        authors: [
          {
            did: 'did:plc:primary' as DID,
            name: 'Primary Author',
            order: 1,
            affiliations: [],
            contributions: [],
            isCorrespondingAuthor: true,
            isHighlighted: false,
          },
          externalAuthor,
        ],
      });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'external-collab',
          record
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:user1/pub.chive.eprint.submission/external-collab' as AtUri
      );

      expect(indexed?.authors[1]?.did).toBeUndefined();
      expect(indexed?.authors[1]?.email).toBe('external@partner.org');
      expect(indexed?.authors[1]?.orcid).toBe('0000-0003-9999-8888');
    });

    it('indexes author affiliations with ROR IDs', async () => {
      const authorWithAffiliations: EprintAuthor = {
        did: 'did:plc:multi-affil' as DID,
        name: 'Multi-Affiliation Author',
        order: 1,
        affiliations: [
          {
            name: 'Stanford University',
            rorId: 'https://ror.org/00f54p054',
            department: 'Computer Science',
          },
          {
            name: 'Google Research',
            rorId: 'https://ror.org/00njsd438',
          },
        ],
        contributions: [],
        isCorrespondingAuthor: true,
        isHighlighted: false,
      };

      const record = createEprintRecord({ authors: [authorWithAffiliations] });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'multi-affil',
          record
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:user1/pub.chive.eprint.submission/multi-affil' as AtUri
      );

      expect(indexed?.authors[0]?.affiliations).toHaveLength(2);
      expect(indexed?.authors[0]?.affiliations[0]?.rorId).toBe('https://ror.org/00f54p054');
      expect(indexed?.authors[0]?.affiliations[1]?.name).toBe('Google Research');
    });

    it('indexes author contributions with degrees', async () => {
      const authorWithContributions: EprintAuthor = {
        did: 'did:plc:contributor' as DID,
        name: 'Contributing Author',
        order: 1,
        affiliations: [],
        contributions: [
          {
            typeUri:
              `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/e1612645-6a62-59b7-a13a-8d618637be85` as AtUri,
            typeId: 'conceptualization',
            typeLabel: 'Conceptualization',
            degree: 'lead',
          },
          {
            typeUri:
              `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/052bfbce-9b15-55fd-8efc-99e82f7abeb2` as AtUri,
            typeId: 'methodology',
            typeLabel: 'Methodology',
            degree: 'equal',
          },
          {
            typeUri:
              `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/829cce56-857a-5abb-be9d-9e6b29f51198` as AtUri,
            typeId: 'writing-original-draft',
            typeLabel: 'Writing - Original Draft',
            degree: 'supporting',
          },
        ],
        isCorrespondingAuthor: true,
        isHighlighted: false,
      };

      const record = createEprintRecord({ authors: [authorWithContributions] });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'contributions',
          record
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:user1/pub.chive.eprint.submission/contributions' as AtUri
      );

      expect(indexed?.authors[0]?.contributions).toHaveLength(3);
      expect(indexed?.authors[0]?.contributions[0]?.degree).toBe('lead');
      expect(indexed?.authors[0]?.contributions[1]?.degree).toBe('equal');
      expect(indexed?.authors[0]?.contributions[2]?.degree).toBe('supporting');
    });
  });

  describe('Traditional vs Paper-Centric Submissions', () => {
    it('indexes traditional submission (no paperDid)', async () => {
      const record = createEprintRecord({
        submittedBy: 'did:plc:user1' as DID,
        // paperDid is undefined - traditional model
      });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'traditional',
          record
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:user1/pub.chive.eprint.submission/traditional' as AtUri
      );

      expect(indexed?.submittedBy).toBe('did:plc:user1');
      expect(indexed?.paperDid).toBeUndefined();
      expect(indexed?.pdsUrl).toBe('https://user1.bsky.social');
    });

    it('indexes paper-centric submission (with paperDid)', async () => {
      const record = createEprintRecord({
        submittedBy: 'did:plc:user1' as DID,
        paperDid: 'did:plc:paper-abc' as DID,
      });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:paper-abc' as DID, // Record lives in paper's repo
          'create',
          'pub.chive.eprint.submission',
          'paper-centric',
          record
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:paper-abc/pub.chive.eprint.submission/paper-centric' as AtUri
      );

      expect(indexed?.submittedBy).toBe('did:plc:user1');
      expect(indexed?.paperDid).toBe('did:plc:paper-abc');
      expect(indexed?.pdsUrl).toBe('https://paper-abc.pds.example.com');
    });

    it('distinguishes submitter from paper identity', async () => {
      const author: EprintAuthor = {
        did: 'did:plc:actual-author' as DID,
        name: 'Actual Author',
        order: 1,
        affiliations: [],
        contributions: [],
        isCorrespondingAuthor: true,
        isHighlighted: false,
      };

      const record = createEprintRecord({
        submittedBy: 'did:plc:user2' as DID, // Human submitter
        paperDid: 'did:plc:paper-abc' as DID, // Paper's own DID
        authors: [author],
      });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:paper-abc' as DID,
          'create',
          'pub.chive.eprint.submission',
          'distinct-identity',
          record
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:paper-abc/pub.chive.eprint.submission/distinct-identity' as AtUri
      );

      // All three DIDs are distinct
      expect(indexed?.submittedBy).toBe('did:plc:user2');
      expect(indexed?.paperDid).toBe('did:plc:paper-abc');
      expect(indexed?.authors[0]?.did).toBe('did:plc:actual-author');
    });
  });

  describe('Update Operation', () => {
    it('updates indexed eprint with new authors', async () => {
      // First create
      const createRecord = createEprintRecord({
        title: 'Original Title',
        authors: [
          {
            did: 'did:plc:author1' as DID,
            name: 'Original Author',
            order: 1,
            affiliations: [],
            contributions: [],
            isCorrespondingAuthor: true,
            isHighlighted: false,
          },
        ],
      });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'to-update',
          createRecord
        )
      );

      // Then update with new author
      const updateRecord = createEprintRecord({
        title: 'Updated Title',
        authors: [
          {
            did: 'did:plc:author1' as DID,
            name: 'Original Author',
            order: 1,
            affiliations: [],
            contributions: [],
            isCorrespondingAuthor: true,
            isHighlighted: false,
          },
          {
            did: 'did:plc:author2' as DID,
            name: 'New Co-Author',
            order: 2,
            affiliations: [],
            contributions: [],
            isCorrespondingAuthor: false,
            isHighlighted: false,
          },
        ],
      });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'update',
          'pub.chive.eprint.submission',
          'to-update',
          updateRecord,
          'bafynewcid' as CID
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:user1/pub.chive.eprint.submission/to-update' as AtUri
      );

      expect(indexed?.title).toBe('Updated Title');
      expect(indexed?.authors).toHaveLength(2);
      expect(indexed?.authors[1]?.name).toBe('New Co-Author');
    });

    it('updates CID on update operation', async () => {
      const record = createEprintRecord();

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'cid-update',
          record,
          'bafyoriginal' as CID
        )
      );

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'update',
          'pub.chive.eprint.submission',
          'cid-update',
          record,
          'bafynewcid' as CID
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:user1/pub.chive.eprint.submission/cid-update' as AtUri
      );

      expect(indexed?.cid).toBe('bafynewcid');
    });
  });

  describe('Delete Operation', () => {
    it('removes eprint from index on delete', async () => {
      const record = createEprintRecord();

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'to-delete',
          record
        )
      );

      expect(
        indexer.getIndexed('at://did:plc:user1/pub.chive.eprint.submission/to-delete' as AtUri)
      ).toBeDefined();

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'delete',
          'pub.chive.eprint.submission',
          'to-delete'
        )
      );

      expect(
        indexer.getIndexed('at://did:plc:user1/pub.chive.eprint.submission/to-delete' as AtUri)
      ).toBeUndefined();
    });
  });

  describe('Highlighted and Corresponding Authors', () => {
    it('preserves highlighted author flag through indexing', async () => {
      const authors: EprintAuthor[] = [
        {
          did: 'did:plc:first' as DID,
          name: 'First Author',
          order: 1,
          affiliations: [],
          contributions: [],
          isCorrespondingAuthor: false,
          isHighlighted: true, // Co-first
        },
        {
          did: 'did:plc:second' as DID,
          name: 'Second Author',
          order: 2,
          affiliations: [],
          contributions: [],
          isCorrespondingAuthor: true,
          isHighlighted: true, // Co-first
        },
        {
          did: 'did:plc:last' as DID,
          name: 'Last Author',
          order: 3,
          affiliations: [],
          contributions: [],
          isCorrespondingAuthor: false,
          isHighlighted: false,
        },
      ];

      const record = createEprintRecord({ authors });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'highlighted',
          record
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:user1/pub.chive.eprint.submission/highlighted' as AtUri
      );

      expect(indexed?.authors[0]?.isHighlighted).toBe(true);
      expect(indexed?.authors[1]?.isHighlighted).toBe(true);
      expect(indexed?.authors[2]?.isHighlighted).toBe(false);
    });

    it('preserves corresponding author flag through indexing', async () => {
      const authors: EprintAuthor[] = [
        {
          did: 'did:plc:first' as DID,
          name: 'First Author',
          order: 1,
          affiliations: [],
          contributions: [],
          isCorrespondingAuthor: true,
          isHighlighted: false,
        },
        {
          did: 'did:plc:second' as DID,
          name: 'Second Author',
          order: 2,
          affiliations: [],
          contributions: [],
          isCorrespondingAuthor: false,
          isHighlighted: false,
        },
      ];

      const record = createEprintRecord({ authors });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'corresponding',
          record
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:user1/pub.chive.eprint.submission/corresponding' as AtUri
      );

      expect(indexed?.authors[0]?.isCorrespondingAuthor).toBe(true);
      expect(indexed?.authors[1]?.isCorrespondingAuthor).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty authors array', async () => {
      const record = createEprintRecord({ authors: [] });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'no-authors',
          record
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:user1/pub.chive.eprint.submission/no-authors' as AtUri
      );

      expect(indexed?.authors).toHaveLength(0);
    });

    it('handles author with minimal fields', async () => {
      const minimalAuthor: EprintAuthor = {
        name: 'Minimal Author',
        order: 1,
        affiliations: [],
        contributions: [],
        isCorrespondingAuthor: false,
        isHighlighted: false,
      };

      const record = createEprintRecord({ authors: [minimalAuthor] });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'minimal-author',
          record
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:user1/pub.chive.eprint.submission/minimal-author' as AtUri
      );

      expect(indexed?.authors[0]?.name).toBe('Minimal Author');
      expect(indexed?.authors[0]?.did).toBeUndefined();
      expect(indexed?.authors[0]?.orcid).toBeUndefined();
      expect(indexed?.authors[0]?.email).toBeUndefined();
    });

    it('handles large author list (50+ authors)', async () => {
      const manyAuthors: EprintAuthor[] = Array.from({ length: 50 }, (_, i) => ({
        did: `did:plc:author${i}` as DID,
        name: `Author ${i + 1}`,
        order: i + 1,
        affiliations: [],
        contributions: [],
        isCorrespondingAuthor: i === 0,
        isHighlighted: i < 3, // First 3 are co-first
      }));

      const record = createEprintRecord({ authors: manyAuthors });

      await firehose.emit(
        createFirehoseEvent(
          'did:plc:user1' as DID,
          'create',
          'pub.chive.eprint.submission',
          'many-authors',
          record
        )
      );

      const indexed = indexer.getIndexed(
        'at://did:plc:user1/pub.chive.eprint.submission/many-authors' as AtUri
      );

      expect(indexed?.authors).toHaveLength(50);
      expect(indexed?.authors[49]?.order).toBe(50);
    });
  });
});
