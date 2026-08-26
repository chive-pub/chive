/**
 * Unit tests for eprint deletion and its reconciliation with search.
 *
 * @remarks
 * Deletion used to remove the PostgreSQL row outright and then drop the
 * Elasticsearch document on a best-effort basis. When the Elasticsearch call
 * failed, the row was already gone — so nothing recorded that a document still
 * needed removing. The search index kept serving a record that existed nowhere
 * else, and no sweep could find it, because finding it required the row that
 * had just been deleted.
 *
 * The soft-delete migration added `deleted_at` and `deletion_source` for
 * precisely this, and annotations already worked this way; eprints did not.
 * Keeping the row leaves a record to reconcile against.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { EprintService } from '@/services/eprint/eprint-service.js';
import type { AtUri } from '@/types/atproto.js';

interface StorageDouble {
  softDeleteEprint: Mock;
  deleteEprint: Mock;
  listDeletedEprintUris: Mock;
}

interface SearchDouble {
  deleteDocument: Mock;
}

interface LoggerDouble {
  debug: Mock;
  info: Mock;
  warn: Mock;
  error: Mock;
}

const URI = 'at://did:plc:izttpdp3l6vss5crelt5kcux/pub.chive.eprint.submission/abc' as AtUri;
const OTHER = 'at://did:plc:izttpdp3l6vss5crelt5kcux/pub.chive.eprint.submission/def' as AtUri;

describe('eprint deletion', () => {
  let storage: StorageDouble;
  let search: SearchDouble;
  let logger: LoggerDouble;
  let service: EprintService;

  beforeEach(() => {
    storage = {
      softDeleteEprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
      deleteEprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
      listDeletedEprintUris: vi.fn().mockResolvedValue([]),
    };
    search = { deleteDocument: vi.fn().mockResolvedValue(undefined) };
    logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    service = new EprintService({
      storage,
      search,
      logger,
      versionManager: { getVersionChain: vi.fn().mockResolvedValue({ versions: [] }) },
    } as never);
  });

  it('marks the row deleted rather than removing it', async () => {
    await service.indexEprintDelete(URI);
    expect(storage.softDeleteEprint).toHaveBeenCalledWith(URI, 'firehose_tombstone');
    expect(storage.deleteEprint).not.toHaveBeenCalled();
  });

  it('still removes the search document', async () => {
    await service.indexEprintDelete(URI);
    expect(search.deleteDocument).toHaveBeenCalledWith(URI);
  });

  // The case that used to lose the record permanently.
  it('reports success and leaves the row marked when the search delete fails', async () => {
    search.deleteDocument.mockRejectedValue(new Error('elasticsearch down'));

    const result = await service.indexEprintDelete(URI);

    expect(result.ok).toBe(true);
    expect(storage.softDeleteEprint).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('reconcileDeletedFromSearch', () => {
  let storage: StorageDouble;
  let search: SearchDouble;
  let service: EprintService;

  beforeEach(() => {
    storage = {
      softDeleteEprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
      deleteEprint: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
      listDeletedEprintUris: vi.fn().mockResolvedValue([URI, OTHER]),
    };
    search = { deleteDocument: vi.fn().mockResolvedValue(undefined) };

    service = new EprintService({
      storage,
      search,
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      versionManager: { getVersionChain: vi.fn().mockResolvedValue({ versions: [] }) },
    } as never);
  });

  it('re-issues the search delete for every deleted eprint', async () => {
    const result = await service.reconcileDeletedFromSearch();

    expect(search.deleteDocument).toHaveBeenCalledWith(URI);
    expect(search.deleteDocument).toHaveBeenCalledWith(OTHER);
    expect(result).toEqual({ reconciled: 2, failed: 0 });
  });

  // One failure must not abort the sweep; the rest still get reconciled.
  it('continues past a failure and counts it', async () => {
    search.deleteDocument.mockRejectedValueOnce(new Error('still down'));

    const result = await service.reconcileDeletedFromSearch();

    expect(result).toEqual({ reconciled: 1, failed: 1 });
    expect(search.deleteDocument).toHaveBeenCalledTimes(2);
  });

  it('does nothing when there are no deleted eprints', async () => {
    storage.listDeletedEprintUris.mockResolvedValue([]);

    const result = await service.reconcileDeletedFromSearch();

    expect(search.deleteDocument).not.toHaveBeenCalled();
    expect(result).toEqual({ reconciled: 0, failed: 0 });
  });

  it('passes the limit through to the query', async () => {
    await service.reconcileDeletedFromSearch(50);
    expect(storage.listDeletedEprintUris).toHaveBeenCalledWith(50);
  });
});
