/**
 * Unit tests for EprintService deletion cleanup paths.
 *
 * @remarks
 * Covers two regressions: citation and related-work tombstones were routed to
 * index tables that no migration creates, and eprint deletion left the Neo4j
 * eprint node (and every edge hanging off it) behind.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { EprintService } from '@/services/eprint/eprint-service.js';
import type { TagManager } from '@/storage/neo4j/tag-manager.js';
import type { AtUri } from '@/types/atproto.js';
import type { IGraphDatabase } from '@/types/interfaces/graph.interface.js';
import type { IIdentityResolver } from '@/types/interfaces/identity.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IRepository } from '@/types/interfaces/repository.interface.js';
import type { ISearchEngine } from '@/types/interfaces/search.interface.js';
import type { IStorageBackend } from '@/types/interfaces/storage.interface.js';

const EPRINT_URI = 'at://did:plc:author123/pub.chive.eprint.submission/abc123' as AtUri;

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createMockStorage = () => ({
  deleteEprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  deleteByUri: vi.fn().mockResolvedValue(undefined),
  deleteCitation: vi.fn().mockResolvedValue(undefined),
  deleteRelatedWork: vi.fn().mockResolvedValue(undefined),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createMockSearch = () => ({
  deleteDocument: vi.fn().mockResolvedValue(undefined),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createMockGraph = () => ({
  deleteNode: vi.fn().mockResolvedValue(undefined),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createMockTagManager = () => ({
  removeAllTagsForRecord: vi.fn().mockResolvedValue(0),
});

describe('EprintService deletion cleanup', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let search: ReturnType<typeof createMockSearch>;
  let graph: ReturnType<typeof createMockGraph>;
  let tagManager: ReturnType<typeof createMockTagManager>;
  let logger: ILogger;
  let service: EprintService;

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const build = (options?: { withGraph?: boolean }) =>
    new EprintService({
      storage: storage as unknown as IStorageBackend,
      search: search as unknown as ISearchEngine,
      repository: {} as unknown as IRepository,
      identity: {} as unknown as IIdentityResolver,
      logger,
      tagManager: tagManager as unknown as TagManager,
      graph: (options?.withGraph ?? true) ? (graph as unknown as IGraphDatabase) : undefined,
    });

  beforeEach(() => {
    storage = createMockStorage();
    search = createMockSearch();
    graph = createMockGraph();
    tagManager = createMockTagManager();
    logger = createMockLogger();
    service = build();
  });

  describe('deleteFromIndex', () => {
    it('routes citation tombstones to deleteCitation', async () => {
      const uri = 'at://did:plc:author123/pub.chive.eprint.citation/c1' as AtUri;

      await service.deleteFromIndex(uri, 'pub.chive.eprint.citation');

      expect(storage.deleteCitation).toHaveBeenCalledWith(uri);
      // extracted_citations is keyed by user_record_uri, so deleteByUri cannot serve it
      expect(storage.deleteByUri).not.toHaveBeenCalled();
    });

    it('routes related-work tombstones to deleteRelatedWork', async () => {
      const uri = 'at://did:plc:author123/pub.chive.eprint.relatedWork/r1' as AtUri;

      await service.deleteFromIndex(uri, 'pub.chive.eprint.relatedWork');

      expect(storage.deleteRelatedWork).toHaveBeenCalledWith(uri);
      expect(storage.deleteByUri).not.toHaveBeenCalled();
    });

    it('never passes a table name that no migration creates', async () => {
      const collections = [
        'pub.chive.eprint.userTag',
        'pub.chive.review.comment',
        'pub.chive.review.endorsement',
        'pub.chive.eprint.citation',
        'pub.chive.eprint.relatedWork',
      ];

      for (const collection of collections) {
        await service.deleteFromIndex(EPRINT_URI, collection);
      }

      const tables = storage.deleteByUri.mock.calls.map((call) => call[0] as string);
      expect(tables).toEqual(['user_tags_index', 'reviews_index', 'endorsements_index']);
    });
  });

  describe('indexEprintDelete', () => {
    it('removes the eprint node from Neo4j', async () => {
      const result = await service.indexEprintDelete(EPRINT_URI);

      expect(result.ok).toBe(true);
      expect(graph.deleteNode).toHaveBeenCalledWith(EPRINT_URI);
    });

    it('succeeds without a graph configured', async () => {
      const serviceWithoutGraph = build({ withGraph: false });

      const result = await serviceWithoutGraph.indexEprintDelete(EPRINT_URI);

      expect(result.ok).toBe(true);
      expect(graph.deleteNode).not.toHaveBeenCalled();
    });

    it('continues when the graph cleanup fails', async () => {
      graph.deleteNode.mockRejectedValue(new Error('Neo4j unavailable'));

      const result = await service.indexEprintDelete(EPRINT_URI);

      expect(result.ok).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Neo4j node cleanup failed, PostgreSQL is source of truth',
        { uri: EPRINT_URI, error: 'Neo4j unavailable' }
      );
      expect(logger.info).toHaveBeenCalledWith('Deleted eprint from indexes', { uri: EPRINT_URI });
    });

    it('cleans up the graph even when tag removal fails', async () => {
      tagManager.removeAllTagsForRecord.mockRejectedValue(new Error('Neo4j tag failure'));

      const result = await service.indexEprintDelete(EPRINT_URI);

      expect(result.ok).toBe(true);
      expect(graph.deleteNode).toHaveBeenCalledWith(EPRINT_URI);
    });
  });
});
