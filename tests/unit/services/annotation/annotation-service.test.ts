/**
 * Unit tests for AnnotationService.
 *
 * @remarks
 * Tests annotation comment and entity link indexing, threaded retrieval,
 * author listing, and soft-delete functionality with a mock PostgreSQL pool.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { AnnotationService } from '@/services/annotation/annotation-service.js';
import type { RecordMetadata } from '@/services/eprint/eprint-service.js';
import type { AtUri, CID, DID } from '@/types/atproto.js';
import { DatabaseError, ValidationError } from '@/types/errors.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// =============================================================================
// MOCKS
// =============================================================================

interface MockLogger extends ILogger {
  debugMock: ReturnType<typeof vi.fn>;
  infoMock: ReturnType<typeof vi.fn>;
  warnMock: ReturnType<typeof vi.fn>;
  errorMock: ReturnType<typeof vi.fn>;
}

interface MockPool {
  query: Mock;
}

const createMockLogger = (): MockLogger => {
  const debugMock = vi.fn();
  const infoMock = vi.fn();
  const warnMock = vi.fn();
  const errorMock = vi.fn();
  const logger: MockLogger = {
    debug: debugMock,
    info: infoMock,
    warn: warnMock,
    error: errorMock,
    child: vi.fn(function (this: void) {
      return logger;
    }),
    debugMock,
    infoMock,
    warnMock,
    errorMock,
  };
  return logger;
};

const createMockPool = (): MockPool => ({
  query: vi.fn(),
});

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

/**
 * Creates a valid annotation comment record matching the lexicon schema.
 */
const createMockAnnotationComment = (
  overrides?: Record<string, unknown>
): Record<string, unknown> => ({
  eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/abc123',
  target: {
    selector: { type: 'TextQuoteSelector', exact: 'some text' },
    refinedBy: { type: 'PageSelector', pageNumber: 3 },
  },
  body: [
    {
      $type: 'pub.chive.annotation.comment#textItem',
      type: 'text',
      content: 'This passage needs clarification.',
    },
  ],
  createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  ...overrides,
});

/**
 * Creates a valid entity link record matching the lexicon schema.
 */
const createMockEntityLink = (overrides?: Record<string, unknown>): Record<string, unknown> => ({
  eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/abc123',
  target: {
    selector: { type: 'TextQuoteSelector', exact: 'Chomsky (1957)' },
    refinedBy: { type: 'PageSelector', pageNumber: 5 },
  },
  linkedEntity: {
    type: 'citation',
    label: 'Chomsky 1957',
    data: { doi: '10.1234/fake' },
  },
  createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  ...overrides,
});

const createMockMetadata = (overrides?: Partial<RecordMetadata>): RecordMetadata => ({
  uri: 'at://did:plc:annotator/pub.chive.annotation.comment/ann123' as AtUri,
  cid: 'bafyreiannotation123' as CID,
  pdsUrl: 'https://pds.host',
  indexedAt: new Date('2024-01-02T00:00:00Z'),
  ...overrides,
});

// =============================================================================
// TESTS
// =============================================================================

describe('AnnotationService', () => {
  let pool: MockPool;
  let logger: MockLogger;
  let service: AnnotationService;

  beforeEach(() => {
    pool = createMockPool();
    logger = createMockLogger();
    service = new AnnotationService({
      pool: pool as unknown as import('pg').Pool,
      logger,
    });
  });

  // ===========================================================================
  // indexAnnotation
  // ===========================================================================

  describe('indexAnnotation', () => {
    it('indexes a valid annotation comment record', async () => {
      const record = createMockAnnotationComment();
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await service.indexAnnotation(record, metadata);

      expect(result.ok).toBe(true);
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO annotations_index'),
        expect.arrayContaining([metadata.uri, metadata.cid, record.eprintUri])
      );
    });

    it('uses ON CONFLICT upsert for duplicate URIs', async () => {
      const record = createMockAnnotationComment();
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexAnnotation(record, metadata);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (uri) DO UPDATE'),
        expect.any(Array)
      );
    });

    it('extracts the annotator DID from the AT URI', async () => {
      const record = createMockAnnotationComment();
      const metadata = createMockMetadata({
        uri: 'at://did:plc:testuser/pub.chive.annotation.comment/x' as AtUri,
      });

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexAnnotation(record, metadata);

      // The annotator_did param is at index 3 (4th position)
      const callParams = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(callParams[3]).toBe('did:plc:testuser');
    });

    it('stores the parent annotation URI when present', async () => {
      const parentUri = 'at://did:plc:other/pub.chive.annotation.comment/parent1';
      const record = createMockAnnotationComment({ parentAnnotation: parentUri });
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexAnnotation(record, metadata);

      const callParams = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(callParams[5]).toBe(parentUri);
    });

    it('stores null for parent annotation when absent', async () => {
      const record = createMockAnnotationComment();
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexAnnotation(record, metadata);

      const callParams = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(callParams[5]).toBeNull();
    });

    it('extracts page number from target refinedBy', async () => {
      const record = createMockAnnotationComment({
        target: {
          selector: { type: 'TextQuoteSelector', exact: 'text' },
          refinedBy: { type: 'PageSelector', pageNumber: 7 },
        },
      });
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexAnnotation(record, metadata);

      const callParams = pool.query.mock.calls[0]?.[1] as unknown[];
      // page_number is at index 7
      expect(callParams[7]).toBe(7);
    });

    it('defaults motivation to commenting when not specified', async () => {
      const record = createMockAnnotationComment();
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexAnnotation(record, metadata);

      const callParams = pool.query.mock.calls[0]?.[1] as unknown[];
      // motivation is at index 8
      expect(callParams[8]).toBe('commenting');
    });

    it('uses motivationFallback when provided', async () => {
      const record = createMockAnnotationComment({ motivationFallback: 'highlighting' });
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexAnnotation(record, metadata);

      const callParams = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(callParams[8]).toBe('highlighting');
    });

    it('rejects a record missing eprintUri', async () => {
      const record = createMockAnnotationComment({ eprintUri: undefined });
      const metadata = createMockMetadata();

      const result = await service.indexAnnotation(record, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('pub.chive.annotation.comment');
      }
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('rejects a record missing target', async () => {
      const record = createMockAnnotationComment({ target: undefined });
      const metadata = createMockMetadata();

      const result = await service.indexAnnotation(record, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('rejects a record with non-array body', async () => {
      const record = createMockAnnotationComment({ body: 'not an array' });
      const metadata = createMockMetadata();

      const result = await service.indexAnnotation(record, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('rejects a record missing createdAt', async () => {
      const record = createMockAnnotationComment({ createdAt: undefined });
      const metadata = createMockMetadata();

      const result = await service.indexAnnotation(record, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('rejects null input', async () => {
      const result = await service.indexAnnotation(null, createMockMetadata());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('logs a warning when rejecting invalid records', async () => {
      await service.indexAnnotation(null, createMockMetadata());

      expect(logger.warnMock).toHaveBeenCalledWith(
        'Invalid annotation comment record',
        expect.any(Object)
      );
    });

    it('returns a DatabaseError when the query fails', async () => {
      const record = createMockAnnotationComment();
      const metadata = createMockMetadata();

      pool.query.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.indexAnnotation(record, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error.message).toContain('Connection refused');
      }
      expect(logger.errorMock).toHaveBeenCalled();
    });

    it('logs success with relevant context', async () => {
      const record = createMockAnnotationComment();
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexAnnotation(record, metadata);

      expect(logger.infoMock).toHaveBeenCalledWith(
        'Indexed annotation',
        expect.objectContaining({
          uri: metadata.uri,
          eprintUri: record.eprintUri,
        })
      );
    });

    it('extracts facets from body items', async () => {
      const record = createMockAnnotationComment({
        body: [
          {
            type: 'text',
            content: 'See @mention',
            facets: [{ index: { byteStart: 4, byteEnd: 12 }, features: [{ $type: 'mention' }] }],
          },
        ],
      });
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexAnnotation(record, metadata);

      // facetsJson is at index 9
      const callParams = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(callParams[9]).not.toBeNull();
      const parsed = JSON.parse(callParams[9] as string) as unknown[];
      expect(parsed).toHaveLength(1);
    });
  });

  // ===========================================================================
  // indexEntityLink
  // ===========================================================================

  describe('indexEntityLink', () => {
    it('indexes a valid entity link record', async () => {
      const record = createMockEntityLink();
      const metadata = createMockMetadata({
        uri: 'at://did:plc:linker/pub.chive.annotation.entityLink/link1' as AtUri,
      });

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await service.indexEntityLink(record, metadata);

      expect(result.ok).toBe(true);
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO entity_links_index'),
        expect.arrayContaining([metadata.uri, metadata.cid])
      );
    });

    it('uses ON CONFLICT upsert', async () => {
      const record = createMockEntityLink();
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexEntityLink(record, metadata);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (uri) DO UPDATE'),
        expect.any(Array)
      );
    });

    it('extracts entity type, label, and data', async () => {
      const record = createMockEntityLink({
        linkedEntity: {
          type: 'author',
          label: 'Noam Chomsky',
          data: { orcid: '0000-0001-2345-6789' },
        },
      });
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexEntityLink(record, metadata);

      const callParams = pool.query.mock.calls[0]?.[1] as unknown[];
      // entity_type at index 6, entity_data at 7, entity_label at 8
      expect(callParams[6]).toBe('author');
      expect(callParams[8]).toBe('Noam Chomsky');
      const entityData = JSON.parse(callParams[7] as string) as Record<string, unknown>;
      expect(entityData.orcid).toBe('0000-0001-2345-6789');
    });

    it('stores confidence when provided', async () => {
      const record = createMockEntityLink({ confidence: 0.95 });
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexEntityLink(record, metadata);

      const callParams = pool.query.mock.calls[0]?.[1] as unknown[];
      // confidence at index 9
      expect(callParams[9]).toBe(0.95);
    });

    it('stores null for confidence when not provided', async () => {
      const record = createMockEntityLink();
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexEntityLink(record, metadata);

      const callParams = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(callParams[9]).toBeNull();
    });

    it('rejects a record missing eprintUri', async () => {
      const record = createMockEntityLink({ eprintUri: undefined });
      const metadata = createMockMetadata();

      const result = await service.indexEntityLink(record, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('pub.chive.annotation.entityLink');
      }
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('rejects a record missing linkedEntity', async () => {
      const record = createMockEntityLink({ linkedEntity: undefined });
      const metadata = createMockMetadata();

      const result = await service.indexEntityLink(record, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('rejects null input', async () => {
      const result = await service.indexEntityLink(null, createMockMetadata());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('returns a DatabaseError when the query fails', async () => {
      const record = createMockEntityLink();
      const metadata = createMockMetadata();

      pool.query.mockRejectedValueOnce(new Error('Disk full'));

      const result = await service.indexEntityLink(record, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error.message).toContain('Disk full');
      }
      expect(logger.errorMock).toHaveBeenCalled();
    });

    it('logs success with entity type and label', async () => {
      const record = createMockEntityLink();
      const metadata = createMockMetadata();

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.indexEntityLink(record, metadata);

      expect(logger.infoMock).toHaveBeenCalledWith(
        'Indexed entity link',
        expect.objectContaining({
          entityType: 'citation',
          entityLabel: 'Chomsky 1957',
        })
      );
    });
  });

  // ===========================================================================
  // getAnnotations
  // ===========================================================================

  describe('getAnnotations', () => {
    it('returns empty array for eprint without annotations', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [] });

      const threads = await service.getAnnotations(eprintUri);

      expect(threads).toEqual([]);
    });

    it('builds a single thread from a root annotation with replies', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:a1/pub.chive.annotation.comment/root',
            cid: 'bafyroot',
            annotator_did: 'did:plc:a1',
            eprint_uri: eprintUri,
            body: [{ content: 'Root comment' }],
            facets: null,
            parent_annotation: null,
            created_at: new Date('2024-01-01'),
            indexed_at: new Date('2024-01-01'),
            anchor: { source: eprintUri, pageNumber: 1 },
            page_number: 1,
            motivation: 'commenting',
            deleted_at: null,
          },
          {
            uri: 'at://did:plc:a2/pub.chive.annotation.comment/reply1',
            cid: 'bafyreply1',
            annotator_did: 'did:plc:a2',
            eprint_uri: eprintUri,
            body: [{ content: 'Reply text' }],
            facets: null,
            parent_annotation: 'at://did:plc:a1/pub.chive.annotation.comment/root',
            created_at: new Date('2024-01-02'),
            indexed_at: new Date('2024-01-02'),
            anchor: { source: eprintUri, pageNumber: 1 },
            page_number: 1,
            motivation: 'commenting',
            deleted_at: null,
          },
        ],
      });

      const threads = await service.getAnnotations(eprintUri);

      expect(threads).toHaveLength(1);
      expect(threads[0]?.root.content).toBe('Root comment');
      expect(threads[0]?.replies).toHaveLength(1);
      expect(threads[0]?.replies[0]?.root.content).toBe('Reply text');
      expect(threads[0]?.totalReplies).toBe(1);
    });

    it('handles deeply nested threads', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:a/c/root',
            cid: 'cid1',
            annotator_did: 'did:plc:a',
            eprint_uri: eprintUri,
            body: [{ content: 'Root' }],
            facets: null,
            parent_annotation: null,
            created_at: new Date('2024-01-01'),
            indexed_at: new Date('2024-01-01'),
            anchor: null,
            page_number: null,
            motivation: 'commenting',
            deleted_at: null,
          },
          {
            uri: 'at://did:plc:b/c/l1',
            cid: 'cid2',
            annotator_did: 'did:plc:b',
            eprint_uri: eprintUri,
            body: [{ content: 'Level 1' }],
            facets: null,
            parent_annotation: 'at://did:plc:a/c/root',
            created_at: new Date('2024-01-02'),
            indexed_at: new Date('2024-01-02'),
            anchor: null,
            page_number: null,
            motivation: 'commenting',
            deleted_at: null,
          },
          {
            uri: 'at://did:plc:c/c/l2',
            cid: 'cid3',
            annotator_did: 'did:plc:c',
            eprint_uri: eprintUri,
            body: [{ content: 'Level 2' }],
            facets: null,
            parent_annotation: 'at://did:plc:b/c/l1',
            created_at: new Date('2024-01-03'),
            indexed_at: new Date('2024-01-03'),
            anchor: null,
            page_number: null,
            motivation: 'commenting',
            deleted_at: null,
          },
        ],
      });

      const threads = await service.getAnnotations(eprintUri);

      expect(threads).toHaveLength(1);
      expect(threads[0]?.replies).toHaveLength(1);
      expect(threads[0]?.replies[0]?.replies).toHaveLength(1);
      expect(threads[0]?.totalReplies).toBe(2);
    });

    it('builds multiple root threads for unrelated annotations', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:a/c/root1',
            cid: 'cid1',
            annotator_did: 'did:plc:a',
            eprint_uri: eprintUri,
            body: [{ content: 'Thread 1' }],
            facets: null,
            parent_annotation: null,
            created_at: new Date('2024-01-01'),
            indexed_at: new Date('2024-01-01'),
            anchor: null,
            page_number: 1,
            motivation: 'commenting',
            deleted_at: null,
          },
          {
            uri: 'at://did:plc:b/c/root2',
            cid: 'cid2',
            annotator_did: 'did:plc:b',
            eprint_uri: eprintUri,
            body: [{ content: 'Thread 2' }],
            facets: null,
            parent_annotation: null,
            created_at: new Date('2024-01-02'),
            indexed_at: new Date('2024-01-02'),
            anchor: null,
            page_number: 2,
            motivation: 'highlighting',
            deleted_at: null,
          },
        ],
      });

      const threads = await service.getAnnotations(eprintUri);

      expect(threads).toHaveLength(2);
    });

    it('filters by page number when specified', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getAnnotations(eprintUri, { pageNumber: 5 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('a.page_number = $'),
        expect.arrayContaining([eprintUri, 5])
      );
    });

    it('filters by motivation when specified', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getAnnotations(eprintUri, { motivation: 'highlighting' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('a.motivation = $'),
        expect.arrayContaining([eprintUri, 'highlighting'])
      );
    });

    it('applies both page and motivation filters together', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getAnnotations(eprintUri, { pageNumber: 3, motivation: 'commenting' });

      const callArgs = pool.query.mock.calls[0];
      const query = callArgs?.[0] as string;
      const params = callArgs?.[1] as unknown[];
      expect(query).toContain('a.page_number = $');
      expect(query).toContain('a.motivation = $');
      expect(params).toEqual([eprintUri, 3, 'commenting']);
    });

    it('marks deleted annotations with empty content', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:a/c/deleted',
            cid: 'cid1',
            annotator_did: 'did:plc:a',
            eprint_uri: eprintUri,
            body: null,
            facets: null,
            parent_annotation: null,
            created_at: new Date('2024-01-01'),
            indexed_at: new Date('2024-01-01'),
            anchor: null,
            page_number: null,
            motivation: 'commenting',
            deleted_at: new Date('2024-01-05'),
          },
          {
            uri: 'at://did:plc:b/c/child',
            cid: 'cid2',
            annotator_did: 'did:plc:b',
            eprint_uri: eprintUri,
            body: [{ content: 'Still here' }],
            facets: null,
            parent_annotation: 'at://did:plc:a/c/deleted',
            created_at: new Date('2024-01-02'),
            indexed_at: new Date('2024-01-02'),
            anchor: null,
            page_number: null,
            motivation: 'commenting',
            deleted_at: null,
          },
        ],
      });

      const threads = await service.getAnnotations(eprintUri);

      expect(threads).toHaveLength(1);
      expect(threads[0]?.root.deleted).toBe(true);
      expect(threads[0]?.root.content).toBe('');
      expect(threads[0]?.replies).toHaveLength(1);
      expect(threads[0]?.replies[0]?.root.deleted).toBe(false);
      expect(threads[0]?.replies[0]?.root.content).toBe('Still here');
    });

    it('returns empty array on database error', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockRejectedValueOnce(new Error('Query failed'));

      const threads = await service.getAnnotations(eprintUri);

      expect(threads).toEqual([]);
      expect(logger.errorMock).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // getAnnotationsForPage
  // ===========================================================================

  describe('getAnnotationsForPage', () => {
    it('delegates to getAnnotations with pageNumber filter', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getAnnotationsForPage(eprintUri, 4);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('a.page_number = $'),
        expect.arrayContaining([eprintUri, 4])
      );
    });

    it('returns threads for the specified page', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:a/c/page4',
            cid: 'cid1',
            annotator_did: 'did:plc:a',
            eprint_uri: eprintUri,
            body: [{ content: 'On page 4' }],
            facets: null,
            parent_annotation: null,
            created_at: new Date('2024-01-01'),
            indexed_at: new Date('2024-01-01'),
            anchor: { source: eprintUri, pageNumber: 4 },
            page_number: 4,
            motivation: 'commenting',
            deleted_at: null,
          },
        ],
      });

      const threads = await service.getAnnotationsForPage(eprintUri, 4);

      expect(threads).toHaveLength(1);
      expect(threads[0]?.root.target.pageNumber).toBe(4);
    });
  });

  // ===========================================================================
  // getEntityLinks
  // ===========================================================================

  describe('getEntityLinks', () => {
    it('returns empty array for eprint without entity links', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [] });

      const links = await service.getEntityLinks(eprintUri);

      expect(links).toEqual([]);
    });

    it('returns entity link views with correct mapping', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:l/el/1',
            cid: 'bafylink1',
            creator_did: 'did:plc:l',
            eprint_uri: eprintUri,
            anchor: { source: eprintUri, selector: { type: 'TextQuoteSelector' } },
            page_number: 2,
            entity_type: 'citation',
            entity_data: { doi: '10.1234/test' },
            entity_label: 'Test Citation',
            confidence: 0.85,
            created_at: new Date('2024-01-01'),
            indexed_at: new Date('2024-01-01'),
          },
        ],
      });

      const links = await service.getEntityLinks(eprintUri);

      expect(links).toHaveLength(1);
      expect(links[0]?.entityType).toBe('citation');
      expect(links[0]?.entityLabel).toBe('Test Citation');
      expect(links[0]?.confidence).toBe(0.85);
      expect(links[0]?.creator).toBe('did:plc:l');
    });

    it('filters by page number when specified', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getEntityLinks(eprintUri, { pageNumber: 3 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('page_number = $'),
        expect.arrayContaining([eprintUri, 3])
      );
    });

    it('excludes soft-deleted entity links', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getEntityLinks(eprintUri);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at IS NULL'),
        expect.any(Array)
      );
    });

    it('returns confidence as undefined when null in database', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:l/el/1',
            cid: 'cid',
            creator_did: 'did:plc:l',
            eprint_uri: eprintUri,
            anchor: null,
            page_number: null,
            entity_type: 'concept',
            entity_data: {},
            entity_label: 'Some concept',
            confidence: null,
            created_at: new Date('2024-01-01'),
            indexed_at: new Date('2024-01-01'),
          },
        ],
      });

      const links = await service.getEntityLinks(eprintUri);

      expect(links[0]?.confidence).toBeUndefined();
    });

    it('returns empty array on database error', async () => {
      const eprintUri = 'at://did:plc:author/pub.chive.eprint.submission/abc' as AtUri;

      pool.query.mockRejectedValueOnce(new Error('Connection lost'));

      const links = await service.getEntityLinks(eprintUri);

      expect(links).toEqual([]);
      expect(logger.errorMock).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // getAnnotationThread
  // ===========================================================================

  describe('getAnnotationThread', () => {
    it('returns a flat list of annotations via recursive CTE', async () => {
      const rootUri = 'at://did:plc:a/pub.chive.annotation.comment/root' as AtUri;

      // Main recursive query
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: rootUri,
            cid: 'cidroot',
            annotator_did: 'did:plc:a',
            eprint_uri: 'at://did:plc:x/pub.chive.eprint.submission/1',
            body: [{ content: 'Root' }],
            facets: null,
            parent_annotation: null,
            created_at: new Date('2024-01-01'),
            indexed_at: new Date('2024-01-01'),
            anchor: null,
            page_number: null,
            motivation: 'commenting',
            deleted_at: null,
            depth: 0,
          },
          {
            uri: 'at://did:plc:b/pub.chive.annotation.comment/child1',
            cid: 'cidchild',
            annotator_did: 'did:plc:b',
            eprint_uri: 'at://did:plc:x/pub.chive.eprint.submission/1',
            body: [{ content: 'Child' }],
            facets: null,
            parent_annotation: rootUri,
            created_at: new Date('2024-01-02'),
            indexed_at: new Date('2024-01-02'),
            anchor: null,
            page_number: null,
            motivation: 'commenting',
            deleted_at: null,
            depth: 1,
          },
        ],
      });

      // Reply count query
      pool.query.mockResolvedValueOnce({
        rows: [{ parent_uri: rootUri, count: '1' }],
      });

      const views = await service.getAnnotationThread(rootUri);

      expect(views).toHaveLength(2);
      expect(views[0]?.uri).toBe(rootUri);
      expect(views[0]?.content).toBe('Root');
      expect(views[0]?.replyCount).toBe(1);
      expect(views[1]?.content).toBe('Child');
      expect(views[1]?.replyCount).toBe(0);
    });

    it('uses the provided maxDepth parameter', async () => {
      const rootUri = 'at://did:plc:a/pub.chive.annotation.comment/root' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getAnnotationThread(rootUri, 5);

      const callParams = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(callParams[0]).toBe(rootUri);
      expect(callParams[1]).toBe(5);
    });

    it('defaults maxDepth to 10', async () => {
      const rootUri = 'at://did:plc:a/pub.chive.annotation.comment/root' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getAnnotationThread(rootUri);

      const callParams = pool.query.mock.calls[0]?.[1] as unknown[];
      expect(callParams[1]).toBe(10);
    });

    it('uses a recursive CTE in the query', async () => {
      const rootUri = 'at://did:plc:a/pub.chive.annotation.comment/root' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getAnnotationThread(rootUri);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WITH RECURSIVE thread AS'),
        expect.any(Array)
      );
    });

    it('marks deleted annotations with empty content in thread', async () => {
      const rootUri = 'at://did:plc:a/pub.chive.annotation.comment/root' as AtUri;

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: rootUri,
            cid: 'cidroot',
            annotator_did: 'did:plc:a',
            eprint_uri: 'at://did:plc:x/pub.chive.eprint.submission/1',
            body: null,
            facets: null,
            parent_annotation: null,
            created_at: new Date('2024-01-01'),
            indexed_at: new Date('2024-01-01'),
            anchor: null,
            page_number: null,
            motivation: 'commenting',
            deleted_at: new Date('2024-02-01'),
            depth: 0,
          },
        ],
      });

      pool.query.mockResolvedValueOnce({ rows: [] });

      const views = await service.getAnnotationThread(rootUri);

      expect(views).toHaveLength(1);
      expect(views[0]?.deleted).toBe(true);
      expect(views[0]?.content).toBe('');
      expect(views[0]?.body).toBeUndefined();
    });

    it('returns empty array on database error', async () => {
      const rootUri = 'at://did:plc:a/pub.chive.annotation.comment/root' as AtUri;

      pool.query.mockRejectedValueOnce(new Error('Timeout'));

      const views = await service.getAnnotationThread(rootUri);

      expect(views).toEqual([]);
      expect(logger.errorMock).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // listAnnotationsByAuthor
  // ===========================================================================

  describe('listAnnotationsByAuthor', () => {
    it('returns paginated annotations for a given author', async () => {
      const did = 'did:plc:author123' as DID;

      // Count query
      pool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      // Main query
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:author123/pub.chive.annotation.comment/a1',
            cid: 'cid1',
            annotator_did: did,
            eprint_uri: 'at://did:plc:x/pub.chive.eprint.submission/1',
            body: [{ content: 'First annotation' }],
            facets: null,
            parent_annotation: null,
            created_at: new Date('2024-01-01'),
            indexed_at: new Date('2024-01-01'),
            anchor: null,
            page_number: null,
            motivation: 'commenting',
            reply_count: 3,
          },
          {
            uri: 'at://did:plc:author123/pub.chive.annotation.comment/a2',
            cid: 'cid2',
            annotator_did: did,
            eprint_uri: 'at://did:plc:y/pub.chive.eprint.submission/2',
            body: [{ content: 'Second annotation' }],
            facets: null,
            parent_annotation: null,
            created_at: new Date('2024-01-02'),
            indexed_at: new Date('2024-01-02'),
            anchor: null,
            page_number: null,
            motivation: 'highlighting',
            reply_count: 0,
          },
        ],
      });

      const result = await service.listAnnotationsByAuthor(did);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
      expect(result.cursor).toBeUndefined();
      expect(result.items[0]?.content).toBe('First annotation');
      expect(result.items[0]?.replyCount).toBe(3);
      expect(result.items[1]?.motivation).toBe('highlighting');
    });

    it('only returns non-deleted annotations', async () => {
      const did = 'did:plc:author123' as DID;

      pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.listAnnotationsByAuthor(did);

      // Both count and main queries should exclude deleted annotations
      expect(pool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('deleted_at IS NULL'),
        expect.any(Array)
      );
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('deleted_at IS NULL'),
        expect.any(Array)
      );
    });

    it('handles pagination with cursor (offset)', async () => {
      const did = 'did:plc:author123' as DID;

      pool.query.mockResolvedValueOnce({ rows: [{ count: '50' }] });
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            uri: 'at://did:plc:author123/pub.chive.annotation.comment/a26',
            cid: 'cid26',
            annotator_did: did,
            eprint_uri: 'at://did:plc:x/pub.chive.eprint.submission/1',
            body: [{ content: 'Page 2 item' }],
            facets: null,
            parent_annotation: null,
            created_at: new Date('2024-01-01'),
            indexed_at: new Date('2024-01-01'),
            anchor: null,
            page_number: null,
            motivation: 'commenting',
            reply_count: 0,
          },
        ],
      });

      const result = await service.listAnnotationsByAuthor(did, { limit: 25, cursor: '25' });

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('26');
      // Verify offset is used in query
      const mainQueryParams = pool.query.mock.calls[1]?.[1] as unknown[];
      expect(mainQueryParams[2]).toBe(25); // offset
    });

    it('caps limit at 100', async () => {
      const did = 'did:plc:author123' as DID;

      pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.listAnnotationsByAuthor(did, { limit: 999 });

      const mainQueryParams = pool.query.mock.calls[1]?.[1] as unknown[];
      expect(mainQueryParams[1]).toBe(100); // capped limit
    });

    it('defaults limit to 50', async () => {
      const did = 'did:plc:author123' as DID;

      pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.listAnnotationsByAuthor(did);

      const mainQueryParams = pool.query.mock.calls[1]?.[1] as unknown[];
      expect(mainQueryParams[1]).toBe(50); // default limit
    });

    it('returns empty result on database error', async () => {
      const did = 'did:plc:author123' as DID;

      pool.query.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.listAnnotationsByAuthor(did);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(logger.errorMock).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // softDeleteAnnotation
  // ===========================================================================

  describe('softDeleteAnnotation', () => {
    it('soft-deletes an annotation with default source', async () => {
      const uri = 'at://did:plc:a/pub.chive.annotation.comment/del1' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await service.softDeleteAnnotation(uri);

      expect(result.ok).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE annotations_index'), [
        uri,
        'firehose_tombstone',
      ]);
    });

    it('soft-deletes with admin source', async () => {
      const uri = 'at://did:plc:a/pub.chive.annotation.comment/del2' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await service.softDeleteAnnotation(uri, 'admin');

      expect(result.ok).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [uri, 'admin']);
    });

    it('soft-deletes with pds_404 source', async () => {
      const uri = 'at://did:plc:a/pub.chive.annotation.comment/del3' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await service.softDeleteAnnotation(uri, 'pds_404');

      expect(result.ok).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [uri, 'pds_404']);
    });

    it('sets deleted_at and deletion_source', async () => {
      const uri = 'at://did:plc:a/pub.chive.annotation.comment/del4' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.softDeleteAnnotation(uri);

      const query = pool.query.mock.calls[0]?.[0] as string;
      expect(query).toContain('deleted_at = NOW()');
      expect(query).toContain('deletion_source = $2');
    });

    it('logs success with URI and source', async () => {
      const uri = 'at://did:plc:a/pub.chive.annotation.comment/del5' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.softDeleteAnnotation(uri, 'admin');

      expect(logger.infoMock).toHaveBeenCalledWith('Soft-deleted annotation', {
        uri,
        source: 'admin',
      });
    });

    it('returns a DatabaseError when the query fails', async () => {
      const uri = 'at://did:plc:a/pub.chive.annotation.comment/fail' as AtUri;

      pool.query.mockRejectedValueOnce(new Error('Lock timeout'));

      const result = await service.softDeleteAnnotation(uri);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error.message).toContain('Lock timeout');
      }
      expect(logger.errorMock).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // softDeleteEntityLink
  // ===========================================================================

  describe('softDeleteEntityLink', () => {
    it('soft-deletes an entity link with default source', async () => {
      const uri = 'at://did:plc:a/pub.chive.annotation.entityLink/del1' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await service.softDeleteEntityLink(uri);

      expect(result.ok).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE entity_links_index'),
        [uri, 'firehose_tombstone']
      );
    });

    it('soft-deletes with admin source', async () => {
      const uri = 'at://did:plc:a/pub.chive.annotation.entityLink/del2' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await service.softDeleteEntityLink(uri, 'admin');

      expect(result.ok).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [uri, 'admin']);
    });

    it('sets deleted_at and deletion_source on entity_links_index', async () => {
      const uri = 'at://did:plc:a/pub.chive.annotation.entityLink/del3' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.softDeleteEntityLink(uri);

      const query = pool.query.mock.calls[0]?.[0] as string;
      expect(query).toContain('UPDATE entity_links_index');
      expect(query).toContain('deleted_at = NOW()');
      expect(query).toContain('deletion_source = $2');
    });

    it('logs success with URI and source', async () => {
      const uri = 'at://did:plc:a/pub.chive.annotation.entityLink/del4' as AtUri;

      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.softDeleteEntityLink(uri, 'pds_404');

      expect(logger.infoMock).toHaveBeenCalledWith('Soft-deleted entity link', {
        uri,
        source: 'pds_404',
      });
    });

    it('returns a DatabaseError when the query fails', async () => {
      const uri = 'at://did:plc:a/pub.chive.annotation.entityLink/fail' as AtUri;

      pool.query.mockRejectedValueOnce(new Error('Deadlock detected'));

      const result = await service.softDeleteEntityLink(uri);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error.message).toContain('Deadlock detected');
      }
      expect(logger.errorMock).toHaveBeenCalled();
    });
  });
});
