/**
 * Unit tests for soft-delete filtering in eprint read paths.
 *
 * @remarks
 * Deleting an eprint sets `deleted_at` rather than removing the row — the
 * migration that added the column also added the `idx_eprints_active` partial
 * index precisely for `deleted_at IS NULL` lookups. The author, field and
 * keyword read paths never used it, so a withdrawn eprint kept appearing in
 * profiles, in the counts beside them, and in tag and keyword browse.
 *
 * The tag lookup needs a join rather than a predicate: `user_tags_index` rows
 * carry only `eprint_uri`, so without joining `eprints_index` a community tag
 * keeps a deleted eprint reachable.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { PostgreSQLAdapter } from '@/storage/postgresql/adapter.js';
import { EprintsRepository } from '@/storage/postgresql/eprints-repository.js';
import type { DID } from '@/types/atproto.js';

const AUTHOR = 'did:plc:izttpdp3l6vss5crelt5kcux' as DID;

/** Collapses whitespace so assertions do not depend on SQL formatting. */
const flat = (sql: string): string => sql.replace(/\s+/g, ' ');

describe('eprint read paths exclude soft-deleted rows', () => {
  let query: Mock;
  let repository: EprintsRepository;

  beforeEach(() => {
    query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    repository = new EprintsRepository({ query } as never);
  });

  it('filters deleted eprints out of an author listing', async () => {
    await repository.findByAuthor(AUTHOR);
    expect(flat(query.mock.calls[0]?.[0] as string)).toMatch(/deleted_at IS NULL/);
  });

  // The count sits next to the listing in a profile; if it counts deleted rows
  // the two disagree.
  it('filters deleted eprints out of the author count', async () => {
    query.mockResolvedValue({ rows: [{ count: 0 }], rowCount: 1 });
    await repository.countByAuthor(AUTHOR);
    expect(flat(query.mock.calls[0]?.[0] as string)).toMatch(/deleted_at IS NULL/);
  });

  it('filters deleted eprints out of a field listing', async () => {
    await repository.listUrisByFieldUri(['at://did:plc:x/pub.chive.graph.node/f1']);
    expect(flat(query.mock.calls[0]?.[0] as string)).toMatch(/deleted_at IS NULL/);
  });

  // With several field URIs the predicates are OR-ed, so the delete filter has
  // to bind outside that group or it only applies to the last one.
  it('keeps the field predicates grouped so the filter applies to all of them', async () => {
    await repository.listUrisByFieldUri([
      'at://did:plc:x/pub.chive.graph.node/f1',
      'at://did:plc:x/pub.chive.graph.node/f2',
    ]);
    const sql = flat(query.mock.calls[0]?.[0] as string);
    expect(sql).toMatch(/WHERE \(.*OR.*\) AND deleted_at IS NULL/);
  });
});

describe('tag and keyword browse excludes soft-deleted eprints', () => {
  let query: Mock;
  let adapter: PostgreSQLAdapter;

  beforeEach(() => {
    query = vi.fn().mockResolvedValue({ rows: [{ count: '0' }], rowCount: 1 });
    adapter = new PostgreSQLAdapter({ query } as never);
  });

  it('filters the keyword half of the lookup', async () => {
    await adapter.getEprintUrisForTerm('syntax', 10, 0);
    for (const call of query.mock.calls) {
      const sql = flat(call[0] as string);
      expect(sql).toMatch(/unnest\(keywords\) AS k WHERE .* AND deleted_at IS NULL/);
    }
  });

  // A tag row only carries eprint_uri, so the deleted eprint has to be excluded
  // by joining the eprint table rather than by a predicate on the tag table.
  it('joins the eprint table to filter the tag half of the lookup', async () => {
    await adapter.getEprintUrisForTerm('syntax', 10, 0);
    for (const call of query.mock.calls) {
      const sql = flat(call[0] as string);
      expect(sql).toMatch(/user_tags_index t JOIN eprints_index te ON te\.uri = t\.eprint_uri/);
      expect(sql).toMatch(/te\.deleted_at IS NULL/);
    }
  });

  it('applies the filter to the count query as well as the page query', async () => {
    await adapter.getEprintUrisForTerm('syntax', 10, 0);
    expect(query.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
