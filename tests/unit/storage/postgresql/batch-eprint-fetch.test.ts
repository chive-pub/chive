/**
 * Unit tests for batched eprint fetching.
 *
 * @remarks
 * Callers needing many eprints fetched them one at a time. Author autocomplete
 * did this on every keystroke over `limit * 3` search hits — up to 75 sequential
 * database round trips per character typed, each waiting on the one before it.
 * A single `uri = ANY($1)` replaces them.
 *
 * The soft-delete filter is included here for the same reason it was added to
 * the other read paths: a deleted eprint must not reappear through a batch
 * fetch that skipped the check.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { EprintsRepository } from '@/storage/postgresql/eprints-repository.js';
import type { AtUri } from '@/types/atproto.js';

const URI_A = 'at://did:plc:izttpdp3l6vss5crelt5kcux/pub.chive.eprint.submission/a' as AtUri;
const URI_B = 'at://did:plc:izttpdp3l6vss5crelt5kcux/pub.chive.eprint.submission/b' as AtUri;

describe('EprintsRepository.findByUris', () => {
  let query: Mock;
  let repository: EprintsRepository;

  beforeEach(() => {
    query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    repository = new EprintsRepository({ query } as never);
  });

  it('issues a single query for many URIs', async () => {
    await repository.findByUris([URI_A, URI_B]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('passes the URIs as one array parameter', async () => {
    await repository.findByUris([URI_A, URI_B]);
    expect(query.mock.calls[0]?.[1]).toEqual([[URI_A, URI_B]]);
    expect(query.mock.calls[0]?.[0]).toMatch(/uri = ANY\(\$1::text\[\]\)/);
  });

  // A batch fetch that skipped the check would resurrect deleted eprints in any
  // caller that used it.
  it('excludes soft-deleted rows', async () => {
    await repository.findByUris([URI_A]);
    expect(query.mock.calls[0]?.[0]).toMatch(/deleted_at IS NULL/);
  });

  it('does not query at all for an empty list', async () => {
    const result = await repository.findByUris([]);
    expect(query).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it('deduplicates repeated URIs', async () => {
    await repository.findByUris([URI_A, URI_A, URI_B]);
    expect(query.mock.calls[0]?.[1]).toEqual([[URI_A, URI_B]]);
  });

  // The index can legitimately lag a search result, so a URI with no row is
  // absent from the map rather than an error.
  it('omits URIs that have no row', async () => {
    const result = await repository.findByUris([URI_A, URI_B]);
    expect(result.has(URI_A)).toBe(false);
    expect(result.size).toBe(0);
  });
});
