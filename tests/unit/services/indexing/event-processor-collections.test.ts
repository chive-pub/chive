/**
 * Unit tests for the per-collection dispatch in the firehose event processor.
 *
 * @remarks
 * The processor fans every firehose commit out to a collection-specific branch,
 * and each branch has to do two things correctly: apply the create/update path,
 * and remove the record from the index on a delete. A branch that silently
 * swallows a datastore failure leaves the cursor advanced past an event that was
 * never indexed, so the failure paths are pinned here alongside the happy ones.
 * Non-critical failures are expected to reach the DLQ; eprint failures are
 * critical and must also throw so the indexer halts rather than losing the
 * record.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { DeadLetterQueue } from '@/services/indexing/dlq-handler.js';
import {
  createEventProcessor,
  type EventProcessorOptions,
} from '@/services/indexing/event-processor.js';
import type { ProcessedEvent } from '@/services/indexing/indexing-service.js';

const REPO = 'did:plc:testrepo';

/**
 * Builds a firehose commit event for an arbitrary collection.
 */
const event = (
  collection: string,
  action: 'create' | 'update' | 'delete',
  record?: unknown
): ProcessedEvent =>
  ({
    $type: 'commit',
    seq: 11,
    repo: REPO,
    time: '2026-08-25T00:00:00.000Z',
    action,
    collection,
    rkey: '3kxyz',
    cid: 'bafyreiabc',
    record,
  }) as ProcessedEvent;

/**
 * A minimal eprint submission record that survives PDS-record transformation.
 */
const submissionRecord = (): Record<string, unknown> => ({
  $type: 'pub.chive.eprint.submission',
  title: 'A Study in Indexing',
  document: {
    $type: 'blob',
    ref: { $link: 'bafkreiabc123def456' },
    mimeType: 'application/pdf',
    size: 1234,
  },
  authors: [{ name: 'Alice Researcher', order: 1, did: 'did:plc:author123' }],
  createdAt: '2026-01-18T12:00:00.000Z',
  submittedBy: 'did:plc:submitter456',
  abstract: 'An abstract.',
  documentFormat: 'pdf',
});

describe('event processor collection dispatch', () => {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const query = vi.fn();
  const dlqAdd = vi.fn();

  const ok = { ok: true, value: undefined };
  const err = (message: string): { ok: false; error: Error } => ({
    ok: false,
    error: new Error(message),
  });

  const eprintService = {
    indexEprint: vi.fn(),
    indexEprintUpdate: vi.fn(),
    indexEprintDelete: vi.fn(),
  };
  const reviewService = { indexReview: vi.fn(), indexEndorsement: vi.fn() };
  const annotationService = { indexAnnotation: vi.fn(), indexEntityLink: vi.fn() };

  /**
   * Builds a processor over the shared mocks.
   */
  const processor = (extra: Record<string, unknown> = {}): ((e: ProcessedEvent) => Promise<void>) =>
    createEventProcessor({
      pool: { query },
      activity: { correlateWithFirehose: vi.fn().mockResolvedValue({ ok: true, value: null }) },
      eprintService,
      reviewService,
      annotationService,
      graphService: {},
      identity: { getPDSEndpoint: vi.fn().mockResolvedValue('https://pds.example.com') },
      logger,
      dlq: { add: dlqAdd } as unknown as DeadLetterQueue,
      ...extra,
    } as unknown as EventProcessorOptions);

  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ rows: [], rowCount: 0 });
    dlqAdd.mockResolvedValue(1);
    eprintService.indexEprint.mockResolvedValue(ok);
    eprintService.indexEprintUpdate.mockResolvedValue(ok);
    eprintService.indexEprintDelete.mockResolvedValue(ok);
    reviewService.indexReview.mockResolvedValue(ok);
    reviewService.indexEndorsement.mockResolvedValue(ok);
    annotationService.indexAnnotation.mockResolvedValue(ok);
    annotationService.indexEntityLink.mockResolvedValue(ok);
  });

  describe('eprint submissions', () => {
    it('indexes a newly created submission', async () => {
      await processor()(event('pub.chive.eprint.submission', 'create', submissionRecord()));
      expect(eprintService.indexEprint).toHaveBeenCalledTimes(1);
      expect(dlqAdd).not.toHaveBeenCalled();
    });

    it('routes an update through the update path rather than a fresh insert', async () => {
      await processor()(event('pub.chive.eprint.submission', 'update', submissionRecord()));
      expect(eprintService.indexEprintUpdate).toHaveBeenCalledTimes(1);
      expect(eprintService.indexEprint).not.toHaveBeenCalled();
    });

    it('removes a submission deleted from its source PDS', async () => {
      await processor()(event('pub.chive.eprint.submission', 'delete'));
      expect(eprintService.indexEprintDelete).toHaveBeenCalledTimes(1);
    });

    // Eprint failures are critical: the processor both DLQs and rethrows, so a
    // lost submission halts the indexer instead of advancing the cursor past it.
    it('throws and DLQs when the delete fails', async () => {
      eprintService.indexEprintDelete.mockResolvedValue(err('delete exploded'));
      await expect(processor()(event('pub.chive.eprint.submission', 'delete'))).rejects.toThrow(
        /Failed to delete eprint/
      );
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });

    it('throws and DLQs when indexing fails', async () => {
      eprintService.indexEprint.mockResolvedValue(err('index exploded'));
      await expect(
        processor()(event('pub.chive.eprint.submission', 'create', submissionRecord()))
      ).rejects.toThrow(/Failed to create eprint/);
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('changelogs', () => {
    const changelog = {
      eprintUri: `at://${REPO}/pub.chive.eprint.submission/abc`,
      version: { major: 1, minor: 1, patch: 0 },
      sections: [{ category: 'added', items: [{ description: 'A new section.' }] }],
      createdAt: '2026-08-25T00:00:00.000Z',
    };

    it('inserts a changelog into the index', async () => {
      await processor()(event('pub.chive.eprint.changelog', 'create', changelog));
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0]?.[0]).toMatch(/INSERT INTO changelogs_index/);
    });

    it('deletes a changelog by URI', async () => {
      await processor()(event('pub.chive.eprint.changelog', 'delete'));
      expect(query.mock.calls[0]?.[0]).toMatch(/DELETE FROM changelogs_index/);
    });

    it('sends a failed changelog insert to the DLQ without throwing', async () => {
      query.mockRejectedValue(new Error('insert failed'));
      await expect(
        processor()(event('pub.chive.eprint.changelog', 'create', changelog))
      ).resolves.toBeUndefined();
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });

    it('sends a failed changelog delete to the DLQ', async () => {
      query.mockRejectedValue(new Error('delete failed'));
      await processor()(event('pub.chive.eprint.changelog', 'delete'));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('eprint versions', () => {
    const version = {
      eprintUri: `at://${REPO}/pub.chive.eprint.submission/abc`,
      versionNumber: 2,
      changes: 'Revised the analysis.',
      createdAt: '2026-08-25T00:00:00.000Z',
    };

    it('inserts a version into the index', async () => {
      await processor()(event('pub.chive.eprint.version', 'create', version));
      expect(query.mock.calls[0]?.[0]).toMatch(/INSERT INTO eprint_versions_index/);
    });

    it('deletes a version by URI', async () => {
      await processor()(event('pub.chive.eprint.version', 'delete'));
      expect(query.mock.calls[0]?.[0]).toMatch(/DELETE FROM eprint_versions_index/);
    });

    it('sends a failed version insert to the DLQ', async () => {
      query.mockRejectedValue(new Error('insert failed'));
      await processor()(event('pub.chive.eprint.version', 'create', version));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('reviews and endorsements', () => {
    it('indexes a review comment', async () => {
      await processor()(event('pub.chive.review.comment', 'create', { body: 'A comment.' }));
      expect(reviewService.indexReview).toHaveBeenCalledTimes(1);
    });

    it('deletes a review comment by URI', async () => {
      await processor()(event('pub.chive.review.comment', 'delete'));
      expect(query.mock.calls[0]?.[0]).toMatch(/DELETE FROM reviews_index/);
    });

    it('sends a failed review index to the DLQ', async () => {
      reviewService.indexReview.mockResolvedValue(err('review failed'));
      await processor()(event('pub.chive.review.comment', 'create', { body: 'A comment.' }));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });

    it('indexes an endorsement', async () => {
      await processor()(event('pub.chive.review.endorsement', 'create', { rating: 5 }));
      expect(reviewService.indexEndorsement).toHaveBeenCalledTimes(1);
    });

    it('deletes an endorsement by URI', async () => {
      await processor()(event('pub.chive.review.endorsement', 'delete'));
      expect(query.mock.calls[0]?.[0]).toMatch(/DELETE FROM endorsements_index/);
    });

    it('sends a failed endorsement index to the DLQ', async () => {
      reviewService.indexEndorsement.mockResolvedValue(err('endorsement failed'));
      await processor()(event('pub.chive.review.endorsement', 'create', { rating: 5 }));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('annotations', () => {
    it('indexes an annotation comment', async () => {
      await processor()(event('pub.chive.annotation.comment', 'create', { body: 'Note.' }));
      expect(annotationService.indexAnnotation).toHaveBeenCalledTimes(1);
    });

    it('deletes an annotation by URI', async () => {
      await processor()(event('pub.chive.annotation.comment', 'delete'));
      expect(query.mock.calls[0]?.[0]).toMatch(/DELETE FROM annotations_index/);
    });

    it('indexes an entity link', async () => {
      await processor()(event('pub.chive.annotation.entityLink', 'create', { target: 'x' }));
      expect(annotationService.indexEntityLink).toHaveBeenCalledTimes(1);
    });

    it('deletes an entity link by URI', async () => {
      await processor()(event('pub.chive.annotation.entityLink', 'delete'));
      expect(query.mock.calls[0]?.[0]).toMatch(/DELETE FROM entity_links_index/);
    });

    it('sends a failed annotation index to the DLQ', async () => {
      annotationService.indexAnnotation.mockResolvedValue(err('annotation failed'));
      await processor()(event('pub.chive.annotation.comment', 'create', { body: 'Note.' }));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('user tags', () => {
    const tag = {
      eprintUri: `at://${REPO}/pub.chive.eprint.submission/abc`,
      tag: 'Syntax',
      createdAt: '2026-08-25T00:00:00.000Z',
    };

    it('inserts a tag into the index', async () => {
      await processor()(event('pub.chive.eprint.userTag', 'create', tag));
      expect(query.mock.calls[0]?.[0]).toMatch(/INSERT INTO user_tags_index/);
    });

    it('mirrors a new tag into the tag graph', async () => {
      const addTag = vi.fn().mockResolvedValue(undefined);
      await processor({ tagManager: { addTag, normalizeTag: (t: string) => t } })(
        event('pub.chive.eprint.userTag', 'create', tag)
      );
      expect(addTag).toHaveBeenCalledTimes(1);
    });

    // The tag graph is a derived index, so a Neo4j failure must not fail the
    // Postgres insert that the firehose cursor has already advanced past.
    it('keeps the row indexed when the tag graph rejects the tag', async () => {
      const addTag = vi.fn().mockRejectedValue(new Error('neo4j down'));
      await processor({ tagManager: { addTag, normalizeTag: (t: string) => t } })(
        event('pub.chive.eprint.userTag', 'create', tag)
      );
      expect(dlqAdd).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('removes the tag from the graph when the record is deleted', async () => {
      const removeTag = vi.fn().mockResolvedValue(undefined);
      query.mockResolvedValue({
        rows: [{ eprint_uri: tag.eprintUri, tag: 'Syntax' }],
        rowCount: 1,
      });
      await processor({ tagManager: { removeTag, normalizeTag: (t: string) => t } })(
        event('pub.chive.eprint.userTag', 'delete')
      );
      expect(removeTag).toHaveBeenCalledWith(tag.eprintUri, 'Syntax');
    });

    it('sends a failed tag insert to the DLQ', async () => {
      query.mockRejectedValue(new Error('insert failed'));
      await processor()(event('pub.chive.eprint.userTag', 'create', tag));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('citations', () => {
    const citation = {
      eprintUri: `at://${REPO}/pub.chive.eprint.submission/abc`,
      citedWork: { title: 'A Cited Work', doi: '10.1000/xyz' },
      citationType: 'supports',
      createdAt: '2026-08-25T00:00:00.000Z',
    };
    const storage = (): Record<string, unknown> => ({
      indexCitation: vi.fn().mockResolvedValue(undefined),
      deleteCitation: vi.fn().mockResolvedValue(undefined),
      indexRelatedWork: vi.fn().mockResolvedValue(undefined),
      deleteRelatedWork: vi.fn().mockResolvedValue(undefined),
    });

    it('indexes a citation through the storage backend', async () => {
      const s = storage();
      await processor({ storage: s })(event('pub.chive.eprint.citation', 'create', citation));
      expect(s.indexCitation).toHaveBeenCalledTimes(1);
    });

    it('deletes a citation through the storage backend', async () => {
      const s = storage();
      await processor({ storage: s })(event('pub.chive.eprint.citation', 'delete'));
      expect(s.deleteCitation).toHaveBeenCalledWith(expect.stringContaining('at://'));
    });

    // Without a storage backend the branch is a no-op rather than a crash.
    it('ignores a citation when no storage backend is configured', async () => {
      await processor()(event('pub.chive.eprint.citation', 'create', citation));
      expect(dlqAdd).not.toHaveBeenCalled();
    });

    it('adds a CITES edge when the cited work lives in Chive', async () => {
      const upsertCitationsBatch = vi.fn().mockResolvedValue(undefined);
      await processor({
        storage: storage(),
        citationGraph: { upsertCitationsBatch },
      })(
        event('pub.chive.eprint.citation', 'create', {
          ...citation,
          citedWork: {
            ...citation.citedWork,
            chiveUri: `at://${REPO}/pub.chive.eprint.submission/z`,
          },
        })
      );
      expect(upsertCitationsBatch).toHaveBeenCalledTimes(1);
    });

    it('keeps the citation indexed when the CITES upsert fails', async () => {
      const upsertCitationsBatch = vi.fn().mockRejectedValue(new Error('graph down'));
      await processor({
        storage: storage(),
        citationGraph: { upsertCitationsBatch },
      })(
        event('pub.chive.eprint.citation', 'create', {
          ...citation,
          citedWork: {
            ...citation.citedWork,
            chiveUri: `at://${REPO}/pub.chive.eprint.submission/z`,
          },
        })
      );
      expect(dlqAdd).not.toHaveBeenCalled();
    });

    it('sends a failed citation index to the DLQ', async () => {
      const s = storage();
      (s.indexCitation as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('insert failed'));
      await processor({ storage: s })(event('pub.chive.eprint.citation', 'create', citation));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });

    it('sends a failed citation delete to the DLQ', async () => {
      const s = storage();
      (s.deleteCitation as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('delete failed'));
      await processor({ storage: s })(event('pub.chive.eprint.citation', 'delete'));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('related works', () => {
    const relatedWork = {
      eprintUri: `at://${REPO}/pub.chive.eprint.submission/abc`,
      relatedUri: `at://${REPO}/pub.chive.eprint.submission/def`,
      relationType: 'extends',
      createdAt: '2026-08-25T00:00:00.000Z',
    };
    const storage = (): Record<string, unknown> => ({
      indexRelatedWork: vi.fn().mockResolvedValue(undefined),
      deleteRelatedWork: vi.fn().mockResolvedValue(undefined),
    });

    it('indexes a related work through the storage backend', async () => {
      const s = storage();
      await processor({ storage: s })(event('pub.chive.eprint.relatedWork', 'create', relatedWork));
      expect(s.indexRelatedWork).toHaveBeenCalledTimes(1);
    });

    it('deletes a related work through the storage backend', async () => {
      const s = storage();
      await processor({ storage: s })(event('pub.chive.eprint.relatedWork', 'delete'));
      expect(s.deleteRelatedWork).toHaveBeenCalledTimes(1);
    });

    it('sends a failed related-work index to the DLQ', async () => {
      const s = storage();
      (s.indexRelatedWork as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      await processor({ storage: s })(event('pub.chive.eprint.relatedWork', 'create', relatedWork));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('personal graph nodes', () => {
    // A node authored in a user's own repo (rather than the Governance PDS) is a
    // personal node, and takes the personalGraphService path.
    const node = {
      id: 'n1',
      kind: 'concept',
      label: 'Ergativity',
      status: 'active',
      createdAt: '2026-08-25T00:00:00.000Z',
    };
    const okResult = { ok: true, value: undefined };
    const errResult = { ok: false, error: new Error('graph rejected it') };

    const services = (): {
      personalGraphService: Record<string, unknown>;
      collectionService: Record<string, unknown>;
    } => ({
      personalGraphService: {
        indexNode: vi.fn().mockResolvedValue(okResult),
        updateNode: vi.fn().mockResolvedValue(okResult),
        deleteNode: vi.fn().mockResolvedValue(okResult),
      },
      collectionService: {
        indexCollection: vi.fn().mockResolvedValue(okResult),
        updateCollection: vi.fn().mockResolvedValue(okResult),
        deleteCollection: vi.fn().mockResolvedValue(okResult),
      },
    });

    it('indexes a personal node', async () => {
      const s = services();
      await processor(s)(event('pub.chive.graph.node', 'create', node));
      expect(s.personalGraphService.indexNode).toHaveBeenCalledTimes(1);
      expect(s.collectionService.indexCollection).not.toHaveBeenCalled();
    });

    it('routes an update to the update path', async () => {
      const s = services();
      await processor(s)(event('pub.chive.graph.node', 'update', node));
      expect(s.personalGraphService.updateNode).toHaveBeenCalledTimes(1);
    });

    // A node whose subkind is 'collection' is indexed twice: once as a
    // collection, once as an ordinary personal node.
    it('indexes a collection node through both services', async () => {
      const s = services();
      await processor(s)(
        event('pub.chive.graph.node', 'create', { ...node, subkind: 'collection' })
      );
      expect(s.collectionService.indexCollection).toHaveBeenCalledTimes(1);
      expect(s.personalGraphService.indexNode).toHaveBeenCalledTimes(1);
    });

    it('updates a collection node through the collection update path', async () => {
      const s = services();
      await processor(s)(
        event('pub.chive.graph.node', 'update', { ...node, subkind: 'collection' })
      );
      expect(s.collectionService.updateCollection).toHaveBeenCalledTimes(1);
    });

    it('deletes a personal node from both indexes', async () => {
      const s = services();
      await processor(s)(event('pub.chive.graph.node', 'delete'));
      expect(s.collectionService.deleteCollection).toHaveBeenCalledTimes(1);
      expect(s.personalGraphService.deleteNode).toHaveBeenCalledTimes(1);
    });

    // A URI that was never a collection makes deleteCollection fail, which is
    // expected and must not stop the personal-graph delete from running.
    it('still deletes the node when the collection delete reports a miss', async () => {
      const s = services();
      (s.collectionService.deleteCollection as ReturnType<typeof vi.fn>).mockResolvedValue(
        errResult
      );
      await processor(s)(event('pub.chive.graph.node', 'delete'));
      expect(s.personalGraphService.deleteNode).toHaveBeenCalledTimes(1);
      expect(dlqAdd).not.toHaveBeenCalled();
    });

    it('tolerates a collection delete that throws', async () => {
      const s = services();
      (s.collectionService.deleteCollection as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('boom')
      );
      await processor(s)(event('pub.chive.graph.node', 'delete'));
      expect(s.personalGraphService.deleteNode).toHaveBeenCalledTimes(1);
    });

    it('sends a failed personal node delete to the DLQ', async () => {
      const s = services();
      (s.personalGraphService.deleteNode as ReturnType<typeof vi.fn>).mockResolvedValue(errResult);
      await processor(s)(event('pub.chive.graph.node', 'delete'));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });

    it('sends a failed personal node index to the DLQ', async () => {
      const s = services();
      (s.personalGraphService.indexNode as ReturnType<typeof vi.fn>).mockResolvedValue(errResult);
      await processor(s)(event('pub.chive.graph.node', 'create', node));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });

    it('sends a failed collection index to the DLQ without indexing the node', async () => {
      const s = services();
      (s.collectionService.indexCollection as ReturnType<typeof vi.fn>).mockResolvedValue(
        errResult
      );
      await processor(s)(
        event('pub.chive.graph.node', 'create', { ...node, subkind: 'collection' })
      );
      expect(dlqAdd).toHaveBeenCalledTimes(1);
      expect(s.personalGraphService.indexNode).not.toHaveBeenCalled();
    });
  });

  describe('personal graph edges', () => {
    const okResult = { ok: true, value: undefined };
    const errResult = { ok: false, error: new Error('edge rejected') };
    const OWNED = `at://${REPO}/pub.chive.graph.node/collection1`;
    const FOREIGN = 'at://did:plc:someoneelse/pub.chive.graph.node/collection1';

    const edge = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
      id: 'e1',
      sourceUri: `at://${REPO}/pub.chive.eprint.submission/abc`,
      targetUri: OWNED,
      relationSlug: 'relates-to',
      createdAt: '2026-08-25T00:00:00.000Z',
      ...overrides,
    });

    const services = (): {
      personalGraphService: Record<string, unknown>;
      collectionService: Record<string, unknown>;
      collaborationService: Record<string, unknown>;
    } => ({
      personalGraphService: {
        indexEdge: vi.fn().mockResolvedValue(okResult),
        updateEdge: vi.fn().mockResolvedValue(okResult),
        deleteEdge: vi.fn().mockResolvedValue(okResult),
      },
      collectionService: {
        indexCollectionEdge: vi.fn().mockResolvedValue(okResult),
        deleteCollectionEdge: vi.fn().mockResolvedValue(okResult),
      },
      collaborationService: {
        isCollaborator: vi.fn().mockResolvedValue(true),
        parkPendingCollectionEdge: vi.fn().mockResolvedValue(undefined),
      },
    });

    it('indexes an ordinary personal edge', async () => {
      const s = services();
      await processor(s)(event('pub.chive.graph.edge', 'create', edge()));
      expect(s.personalGraphService.indexEdge).toHaveBeenCalledTimes(1);
      expect(s.collectionService.indexCollectionEdge).not.toHaveBeenCalled();
    });

    it('routes an edge update to the update path', async () => {
      const s = services();
      await processor(s)(event('pub.chive.graph.edge', 'update', edge()));
      expect(s.personalGraphService.updateEdge).toHaveBeenCalledTimes(1);
    });

    it('deletes a personal edge', async () => {
      const s = services();
      await processor(s)(event('pub.chive.graph.edge', 'delete', edge()));
      expect(s.personalGraphService.deleteEdge).toHaveBeenCalledTimes(1);
    });

    // 'contains' marks the edge as a collection relation, which takes the
    // collection path in addition to the personal graph.
    it('deletes a collection edge through the collection service', async () => {
      const s = services();
      await processor(s)(
        event('pub.chive.graph.edge', 'delete', edge({ relationSlug: 'contains' }))
      );
      expect(s.collectionService.deleteCollectionEdge).toHaveBeenCalledTimes(1);
    });

    it('indexes a collection edge when the author owns the collection', async () => {
      const s = services();
      await processor(s)(
        event('pub.chive.graph.edge', 'create', edge({ relationSlug: 'contains' }))
      );
      expect(s.collectionService.indexCollectionEdge).toHaveBeenCalledTimes(1);
      expect(s.collaborationService.isCollaborator).not.toHaveBeenCalled();
    });

    it('indexes a foreign collection edge when the author is an active collaborator', async () => {
      const s = services();
      await processor(s)(
        event(
          'pub.chive.graph.edge',
          'create',
          edge({ relationSlug: 'contains', targetUri: FOREIGN })
        )
      );
      expect(s.collaborationService.isCollaborator).toHaveBeenCalledTimes(1);
      expect(s.collectionService.indexCollectionEdge).toHaveBeenCalledTimes(1);
    });

    // An unauthorized author must not have their edge indexed into someone
    // else's collection; it is parked until the collaboration turns active.
    it('parks a foreign collection edge from a non-collaborator', async () => {
      const s = services();
      (s.collaborationService.isCollaborator as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      await processor(s)(
        event(
          'pub.chive.graph.edge',
          'create',
          edge({ relationSlug: 'contains', targetUri: FOREIGN })
        )
      );
      expect(s.collaborationService.parkPendingCollectionEdge).toHaveBeenCalledTimes(1);
      expect(s.collectionService.indexCollectionEdge).not.toHaveBeenCalled();
    });

    it('sends a failed personal edge delete to the DLQ', async () => {
      const s = services();
      (s.personalGraphService.deleteEdge as ReturnType<typeof vi.fn>).mockResolvedValue(errResult);
      await processor(s)(event('pub.chive.graph.edge', 'delete', edge()));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });

    it('sends a failed personal edge index to the DLQ', async () => {
      const s = services();
      (s.personalGraphService.indexEdge as ReturnType<typeof vi.fn>).mockResolvedValue(errResult);
      await processor(s)(event('pub.chive.graph.edge', 'create', edge()));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('actor profiles', () => {
    const profile = { displayName: 'Alice Researcher', bio: 'Linguist.' };

    it('upserts a profile into the authors index', async () => {
      await processor()(event('pub.chive.actor.profile', 'create', profile));
      expect(query).toHaveBeenCalled();
    });

    it('deletes a profile by repo DID', async () => {
      await processor()(event('pub.chive.actor.profile', 'delete'));
      expect(query.mock.calls[0]?.[0]).toMatch(/DELETE FROM authors_index/);
      expect(query.mock.calls[0]?.[1]).toEqual([REPO]);
    });

    it('sends a failed profile upsert to the DLQ', async () => {
      query.mockRejectedValue(new Error('upsert failed'));
      await processor()(event('pub.chive.actor.profile', 'create', profile));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });

    it('sends a failed profile delete to the DLQ', async () => {
      query.mockRejectedValue(new Error('delete failed'));
      await processor()(event('pub.chive.actor.profile', 'delete'));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });

    it('upserts a profile config keyed on the repo DID', async () => {
      await processor()(event('pub.chive.actor.profileConfig', 'create', { theme: 'dark' }));
      expect(query).toHaveBeenCalled();
    });

    it('deletes a profile config by repo DID', async () => {
      await processor()(event('pub.chive.actor.profileConfig', 'delete'));
      expect(query.mock.calls[0]?.[0]).toMatch(/DELETE FROM profile_config/);
    });

    it('sends a failed profile config write to the DLQ', async () => {
      query.mockRejectedValue(new Error('config failed'));
      await processor()(event('pub.chive.actor.profileConfig', 'create', { theme: 'dark' }));
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('collaboration invites', () => {
    const okResult = { ok: true, value: undefined };
    const errResult = { ok: false, error: new Error('invite rejected') };
    const invite = {
      subject: { uri: `at://${REPO}/pub.chive.graph.node/collection1` },
      invitee: 'did:plc:invitee',
      createdAt: '2026-08-25T00:00:00.000Z',
    };

    const collaborationService = (): Record<string, unknown> => ({
      indexInvite: vi.fn().mockResolvedValue(okResult),
      deleteInvite: vi.fn().mockResolvedValue(okResult),
      indexAcceptance: vi.fn().mockResolvedValue(okResult),
      deleteAcceptance: vi.fn().mockResolvedValue(okResult),
    });

    // Collaboration is optional, so a deployment without the service must skip
    // the record rather than fail the event.
    it('ignores an invite when collaboration is not configured', async () => {
      await processor()(event('pub.chive.collaboration.invite', 'create', invite));
      expect(dlqAdd).not.toHaveBeenCalled();
    });

    it('indexes an invite', async () => {
      const c = collaborationService();
      await processor({ collaborationService: c })(
        event('pub.chive.collaboration.invite', 'create', invite)
      );
      expect(c.indexInvite).toHaveBeenCalledTimes(1);
    });

    // A record missing a lexicon-required field is skipped rather than indexed
    // half-formed.
    it('skips an invite missing its subject', async () => {
      const c = collaborationService();
      await processor({ collaborationService: c })(
        event('pub.chive.collaboration.invite', 'create', {
          invitee: 'did:plc:x',
          createdAt: 'now',
        })
      );
      expect(c.indexInvite).not.toHaveBeenCalled();
      expect(dlqAdd).not.toHaveBeenCalled();
    });

    it('skips an invite missing its invitee', async () => {
      const c = collaborationService();
      await processor({ collaborationService: c })(
        event('pub.chive.collaboration.invite', 'create', {
          subject: invite.subject,
          createdAt: 'now',
        })
      );
      expect(c.indexInvite).not.toHaveBeenCalled();
    });

    it('deletes an invite', async () => {
      const c = collaborationService();
      await processor({ collaborationService: c })(
        event('pub.chive.collaboration.invite', 'delete')
      );
      expect(c.deleteInvite).toHaveBeenCalledTimes(1);
    });

    it('sends a failed invite index to the DLQ', async () => {
      const c = collaborationService();
      (c.indexInvite as ReturnType<typeof vi.fn>).mockResolvedValue(errResult);
      await processor({ collaborationService: c })(
        event('pub.chive.collaboration.invite', 'create', invite)
      );
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });

    it('sends a failed invite delete to the DLQ', async () => {
      const c = collaborationService();
      (c.deleteInvite as ReturnType<typeof vi.fn>).mockResolvedValue(errResult);
      await processor({ collaborationService: c })(
        event('pub.chive.collaboration.invite', 'delete')
      );
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });

    it('deletes an invite acceptance', async () => {
      const c = collaborationService();
      await processor({ collaborationService: c })(
        event('pub.chive.collaboration.inviteAcceptance', 'delete')
      );
      expect(c.deleteAcceptance).toHaveBeenCalledTimes(1);
    });

    it('sends a failed acceptance delete to the DLQ', async () => {
      const c = collaborationService();
      (c.deleteAcceptance as ReturnType<typeof vi.fn>).mockResolvedValue(errResult);
      await processor({ collaborationService: c })(
        event('pub.chive.collaboration.inviteAcceptance', 'delete')
      );
      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('unhandled collections', () => {
    // A foreign lexicon is not an error: the processor should ignore it quietly
    // rather than filling the DLQ with records Chive never claimed to index.
    it('ignores a collection outside the pub.chive namespace', async () => {
      await processor()(event('app.bsky.feed.post', 'create', { text: 'hello' }));
      expect(dlqAdd).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    });
  });
});
