/**
 * Index reconstruction compliance test.
 *
 * @remarks
 * Chive's central promise is that its databases hold nothing a user owns: if
 * the entire index were dropped, every eprint would still sit in its author's
 * PDS and the index could be rebuilt by replaying the firehose. Every other
 * compliance rule follows from that one, and until now it was the only golden
 * rule with no executable test — its "verification" was the existence of a
 * cursor table, which demonstrates nothing about whether a replay reproduces
 * the state it replaced.
 *
 * This test replays a fixed sequence of firehose commits through the real
 * event processor and a real PostgreSQL index, snapshots the result, wipes the
 * index the way a lost database would, replays the identical sequence, and
 * requires the two snapshots to match.
 *
 * Requires the Docker test stack (`./scripts/start-test-stack.sh`).
 *
 * @packageDocumentation
 */

import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { EprintService } from '@/services/eprint/eprint-service.js';
import { createEventProcessor } from '@/services/indexing/event-processor.js';
import type { ProcessedEvent } from '@/services/indexing/indexing-service.js';
import { PostgreSQLAdapter } from '@/storage/postgresql/adapter.js';
import { getDatabaseConfig } from '@/storage/postgresql/config.js';
import type { AtUri, DID } from '@/types/atproto.js';
import type { IIdentityResolver } from '@/types/interfaces/identity.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';
import type { IRepository } from '@/types/interfaces/repository.interface.js';
import type {
  ISearchEngine,
  IndexableEprintDocument,
} from '@/types/interfaces/search.interface.js';

const AUTHOR = 'did:plc:reconstructiontestauthor' as DID;
const PDS_URL = 'https://pds.reconstruction.test';

/**
 * Tables the replayed collections write into, with the column identifying the
 * rows this test owns.
 */
const INDEX_TABLES = [
  { table: 'eprints_index', column: 'uri', match: 'prefix' },
  { table: 'eprint_versions_index', column: 'uri', match: 'prefix' },
  { table: 'authors_index', column: 'did', match: 'exact' },
] as const;

/**
 * Columns recording *when Chive processed* a record rather than what it says.
 *
 * @remarks
 * These are wall-clock stamps taken at indexing time, so two replays of the
 * same log necessarily disagree on them; they are the AppView's own bookkeeping
 * and none of them is user data. Every other column — including
 * `deletion_source`, `created_at`, and `updated_at`, which all come from the
 * record — must match exactly.
 *
 * The list is deliberately short. Each entry weakens the reconstruction check,
 * so the test asserts below that every excluded column is actually present and
 * populated, rather than letting a renamed column quietly widen the exemption.
 */
const LOCAL_TIMESTAMP_COLUMNS = ['indexed_at', 'last_synced_at', 'deleted_at'] as const;

function createLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return logger;
}

function createIdentity(): IIdentityResolver {
  return {
    resolveDID: vi.fn().mockResolvedValue({ id: AUTHOR, alsoKnownAs: [], verificationMethod: [] }),
    resolveHandle: vi.fn().mockResolvedValue(AUTHOR),
    getPDSEndpoint: vi.fn().mockResolvedValue(PDS_URL),
  };
}

function createRepository(): IRepository {
  // The processor must not read back from the PDS to rebuild; if it did, a
  // replay would depend on live network state rather than the firehose log.
  return {
    getRecord: vi.fn().mockResolvedValue(null),
    listRecords: vi.fn(),
    getBlob: vi.fn().mockResolvedValue(null),
  };
}

/**
 * Search engine that records what was indexed instead of talking to a cluster.
 *
 * @remarks
 * The search index has to be reconstructible too, and capturing the emitted
 * documents tests that directly without making the assertion depend on
 * Elasticsearch's own refresh timing.
 */
function createRecordingSearch(): ISearchEngine & { documents: Map<string, unknown> } {
  const documents = new Map<string, unknown>();
  return {
    documents,
    indexEprint: (doc: IndexableEprintDocument) => {
      const { indexedAt: _indexedAt, ...stable } = doc;
      documents.set(doc.uri, stable);
      return Promise.resolve();
    },
    search: () => Promise.resolve({ hits: [], total: 0, took: 0 }),
    facetedSearch: () => Promise.resolve({ hits: [], total: 0, took: 0, facets: {} }),
    autocomplete: () => Promise.resolve([]),
    deleteDocument: (uri: AtUri) => {
      documents.delete(uri);
      return Promise.resolve();
    },
    findSimilarByText: () => Promise.resolve([]),
  };
}

function submissionRecord(title: string, abstract: string): Record<string, unknown> {
  return {
    $type: 'pub.chive.eprint.submission',
    title,
    abstract: {
      type: 'RichText',
      items: [{ type: 'text', content: abstract }],
      format: 'application/x-chive-gloss+json',
    },
    authors: [{ did: AUTHOR, name: 'Reconstruction Author', order: 1 }],
    keywords: ['reconstruction', 'compliance'],
    createdAt: '2026-01-01T00:00:00.000Z',
    document: {
      $type: 'blob',
      ref: { $link: 'bafkreiereconstructiondocument' },
      mimeType: 'application/pdf',
      size: 1024,
    },
  };
}

function commit(
  seq: number,
  rkey: string,
  action: 'create' | 'update' | 'delete',
  record?: Record<string, unknown>
): ProcessedEvent {
  return {
    $type: 'commit',
    seq,
    time: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
    repo: AUTHOR,
    collection: 'pub.chive.eprint.submission',
    rkey,
    action,
    cid: `bafyreirecon${rkey}${action}`,
    ...(record ? { record } : {}),
  } as ProcessedEvent;
}

/**
 * A fixed firehose log.
 *
 * @remarks
 * It includes an update and a delete, not only creates: a replay that handles
 * creates but loses ordering would still reproduce a create-only log, so a
 * create-only fixture would pass while proving nothing.
 */
const FIREHOSE_LOG: readonly ProcessedEvent[] = [
  commit(1, 'alpha', 'create', submissionRecord('Alpha', 'First submission.')),
  commit(2, 'beta', 'create', submissionRecord('Beta', 'Second submission.')),
  commit(3, 'alpha', 'update', submissionRecord('Alpha Revised', 'First submission, revised.')),
  commit(4, 'gamma', 'create', submissionRecord('Gamma', 'Third submission.')),
  commit(5, 'beta', 'delete'),
];

describe('ATProto compliance: the index is rebuildable from the firehose', () => {
  let pool: Pool;
  let storage: PostgreSQLAdapter;
  let search: ReturnType<typeof createRecordingSearch>;
  let replay: () => Promise<void>;

  beforeAll(() => {
    pool = new Pool(getDatabaseConfig());
    storage = new PostgreSQLAdapter(pool);
    search = createRecordingSearch();

    const eprintService = new EprintService({
      storage,
      search,
      repository: createRepository(),
      identity: createIdentity(),
      logger: createLogger(),
    });

    const process = createEventProcessor({
      pool,
      activity: {
        correlateWithFirehose: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      eprintService,
      reviewService: {},
      graphService: {},
      identity: createIdentity(),
      logger: createLogger(),
      storage,
    } as unknown as Parameters<typeof createEventProcessor>[0]);

    replay = async () => {
      for (const event of FIREHOSE_LOG) {
        await process(event);
      }
    };
  });

  afterAll(async () => {
    await wipeIndex();
    await pool.end();
  });

  beforeEach(async () => {
    await wipeIndex();
    search.documents.clear();
  });

  /** The WHERE clause and parameter selecting this test's rows in one table. */
  function scope(spec: (typeof INDEX_TABLES)[number]): { where: string; param: string } {
    return spec.match === 'prefix'
      ? { where: `${spec.column} LIKE $1`, param: `at://${AUTHOR}/%` }
      : { where: `${spec.column} = $1`, param: AUTHOR };
  }

  /** Delete everything this test's DID owns, as a lost database would. */
  async function wipeIndex(): Promise<void> {
    for (const spec of INDEX_TABLES) {
      const { where, param } = scope(spec);
      await pool.query(`DELETE FROM ${spec.table} WHERE ${where}`, [param]);
    }
  }

  /** Read the indexed rows this test's DID owns, ordered deterministically. */
  async function snapshotRows(): Promise<Record<string, unknown[]>> {
    const snapshot: Record<string, unknown[]> = {};
    for (const spec of INDEX_TABLES) {
      const { where, param } = scope(spec);
      const result = await pool.query<Record<string, unknown>>(
        `SELECT * FROM ${spec.table} WHERE ${where} ORDER BY ${spec.column}`,
        [param]
      );
      snapshot[spec.table] = result.rows.map((row) => {
        const stable: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          if (!(LOCAL_TIMESTAMP_COLUMNS as readonly string[]).includes(key)) stable[key] = value;
        }
        return stable;
      });
    }
    return snapshot;
  }

  function snapshotSearch(): Record<string, unknown> {
    return Object.fromEntries(
      [...search.documents.entries()].sort(([a], [b]) => a.localeCompare(b))
    );
  }

  it('replaying the same log twice produces the same index', async () => {
    await replay();
    const firstRows = await snapshotRows();
    const firstSearch = snapshotSearch();

    // Guard against a vacuous pass: two empty snapshots would match trivially.
    expect(firstRows.eprints_index?.length ?? 0).toBeGreaterThan(0);
    expect(Object.keys(firstSearch).length).toBeGreaterThan(0);

    // Guard the exemption list: every excluded column must exist on the table
    // it was excluded from. A renamed column would otherwise silently drop out
    // of the comparison and take its real differences with it.
    const rawEprints = await pool.query<Record<string, unknown>>(
      `SELECT * FROM eprints_index WHERE uri LIKE $1 LIMIT 1`,
      [`at://${AUTHOR}/%`]
    );
    const columns = Object.keys(rawEprints.rows[0] ?? {});
    for (const excluded of LOCAL_TIMESTAMP_COLUMNS) {
      expect(columns, `${excluded} is excluded from the comparison`).toContain(excluded);
    }

    await wipeIndex();
    search.documents.clear();
    expect((await snapshotRows()).eprints_index).toEqual([]);

    await replay();

    const secondRows = await snapshotRows();
    // Compare per table so a failure names which index diverged.
    for (const spec of INDEX_TABLES) {
      expect(secondRows[spec.table], spec.table).toEqual(firstRows[spec.table]);
    }
    expect(snapshotSearch()).toEqual(firstSearch);
  });

  it('the rebuilt index reflects the log, not just its final create', async () => {
    await replay();
    const rows = ((await snapshotRows()).eprints_index ?? []) as Record<string, unknown>[];
    const byUri = new Map(rows.map((row) => [String(row.uri), row]));

    // The update at seq 3 must have been applied...
    expect(byUri.get(`at://${AUTHOR}/pub.chive.eprint.submission/alpha`)?.title).toBe(
      'Alpha Revised'
    );
    // ...and the delete at seq 5 must have tombstoned the record it named.
    // The row survives on purpose: a hard delete would drop the evidence that
    // the author retracted the eprint, which a later replay could not recover.
    // `deleted_at` is a processing stamp and so is normalized out of the
    // snapshot; read it from the table directly.
    const tombstones = await pool.query<{ uri: string; deleted_at: Date | null }>(
      `SELECT uri, deleted_at FROM eprints_index WHERE uri LIKE $1`,
      [`at://${AUTHOR}/%`]
    );
    const deletedAt = new Map(tombstones.rows.map((row) => [row.uri, row.deleted_at]));

    expect(byUri.has(`at://${AUTHOR}/pub.chive.eprint.submission/beta`)).toBe(true);
    expect(deletedAt.get(`at://${AUTHOR}/pub.chive.eprint.submission/beta`)).not.toBeNull();
    expect(deletedAt.get(`at://${AUTHOR}/pub.chive.eprint.submission/gamma`)).toBeNull();
  });

  it('the PDS wins when the local index disagrees with the record', async () => {
    await replay();

    // Corrupt the index the way a bad write or a stale row would.
    await pool.query(`UPDATE eprints_index SET title = $1 WHERE uri = $2`, [
      'Locally Corrupted Title',
      `at://${AUTHOR}/pub.chive.eprint.submission/alpha`,
    ]);

    const corrupted = await pool.query(`SELECT title FROM eprints_index WHERE uri = $1`, [
      `at://${AUTHOR}/pub.chive.eprint.submission/alpha`,
    ]);
    expect(corrupted.rows[0]?.title).toBe('Locally Corrupted Title');

    // Re-deliver the same log. Chive holds no authority over the record, so
    // the replayed value must overwrite the local one rather than be merged
    // with it or skipped as already-seen.
    await replay();

    const rows = await pool.query(`SELECT title FROM eprints_index WHERE uri = $1`, [
      `at://${AUTHOR}/pub.chive.eprint.submission/alpha`,
    ]);
    expect(rows.rows[0]?.title).toBe('Alpha Revised');
  });
});
